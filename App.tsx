import React, { useState, useEffect, useCallback } from 'react';
import {
  AppMode,
  ChatMessage,
  MessageRole,
  Source,
  ElasticResult,
  Intent,
  ResponseType,
  CodeSuggestion,
  ModelId,
  MODELS,
  FileViewType,
} from './types';

import * as elastic from './services/elasticService';
import * as gemini from './services/geminiService';

import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import FileViewer from './components/FileViewer';
import FileSearch from './components/FileSearch';
import EditedFilesViewer from './components/EditedFilesViewer';
import DiffViewerModal from './components/DiffViewerModal';

// This is also defined in DiffViewerModal and EditedFilesViewer,
// but not exported. Defining it here to manage state.
interface EditedFileRecord {
  file: Source;
  originalContent: string;
  currentContent: string;
}

// Main App component
const App: React.FC = () => {
  // State variables
  const [mode, setMode] = useState<AppMode>(AppMode.CODEBASE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [allFiles, setAllFiles] = useState<Source[]>([]);
  const [customDataset, setCustomDataset] = useState<ElasticResult[]>([]);
  
  const [isShowingFileSearch, setIsShowingFileSearch] = useState<boolean>(false);
  const [isShowingEditedFiles, setIsShowingEditedFiles] = useState<boolean>(false);

  const [selectedFile, setSelectedFile] = useState<Source | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('Loading...');
  const [selectedFileViewType, setSelectedFileViewType] = useState<FileViewType | null>(null);
  
  const [editedFiles, setEditedFiles] = useState<Map<string, EditedFileRecord>>(new Map());
  const [selectedEditedFileRecord, setSelectedEditedFileRecord] = useState<EditedFileRecord | null>(null);
  
  const [selectedModel, setSelectedModel] = useState<ModelId>(ModelId.GEMINI_FLASH_LITE);

  // --- Effects ---

  // Fetch all files when mode changes
  const fetchFiles = useCallback(async () => {
    const files = await elastic.getAllFiles(mode, mode === AppMode.CUSTOM ? customDataset : undefined);
    setAllFiles(files);
  }, [mode, customDataset]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);
  
  // --- Handlers ---
  
  const handleNewChat = () => {
    setMessages([]);
  };
  
  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
    setMessages([]);
    setAllFiles([]); // Clear files before fetching new ones
    setIsShowingFileSearch(false);
    setIsShowingEditedFiles(false);
    setEditedFiles(new Map()); // Reset edits on mode change
  };

  const handleToggleFileSearch = () => {
    setIsShowingFileSearch(prev => !prev);
    setIsShowingEditedFiles(false);
  };
  
  const handleToggleEditedFiles = () => {
    setIsShowingEditedFiles(prev => !prev);
    setIsShowingFileSearch(false);
  };

  const handleSelectSource = async (source: Source) => {
    setSelectedFile(source);
    setSelectedFileContent('Loading...');
    setSelectedFileViewType(null); // Reset view type

    const content = await elastic.getFileContent(source, mode, mode === AppMode.CUSTOM ? customDataset : undefined);
    if (content) {
      setSelectedFileContent(content);
      const viewType = await gemini.classifyFileContent(content);
      setSelectedFileViewType(viewType);
    } else {
      setSelectedFileContent('Error: Could not load file content.');
    }
  };
  
  const handleFilesUploaded = async (fileList: FileList) => {
    if (mode !== AppMode.CUSTOM) {
      // Switch to custom mode if files are uploaded
      handleModeChange(AppMode.CUSTOM);
    }
    const dataset = await elastic.createDatasetFromFileList(fileList);
    setCustomDataset(dataset);
    setMessages([]);
  };

  const handleSuggestionAction = async (messageIndex: number, action: 'accepted' | 'rejected') => {
    const message = messages[messageIndex];
    if (!message.suggestion) return;

    const updatedSuggestion = { ...message.suggestion, status: action };
    const updatedMessages = [...messages];
    updatedMessages[messageIndex] = { ...message, suggestion: updatedSuggestion };
    
    if (action === 'accepted') {
      const { file, suggestedContent, originalContent } = message.suggestion;
      const success = await elastic.updateFileContent(file, suggestedContent, mode);
      if(success) {
        // Record the edit
        const newRecord: EditedFileRecord = {
          file,
          originalContent: editedFiles.get(file.id)?.originalContent ?? originalContent,
          currentContent: suggestedContent,
        };
        setEditedFiles(new Map(editedFiles.set(file.id, newRecord)));
        
        updatedMessages[messageIndex].editedFile = file;
      }
    }
    
    setMessages(updatedMessages);
  };

  const handleSendMessage = async (query: string) => {
    setIsLoading(true);
    const userMessage: ChatMessage = { role: MessageRole.USER, content: query };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    
    const modelDefinition = MODELS.find(m => m.id === selectedModel);
    if (!modelDefinition) {
      console.error("Selected model not found");
      setIsLoading(false);
      return;
    }

    // Add a placeholder for the model's response
    setMessages(prev => [...prev, { role: MessageRole.MODEL, content: '', modelId: selectedModel }]);
    
    try {
      // 1. Search for relevant documents
      const context = await elastic.searchDocuments(query, mode, mode === AppMode.CUSTOM ? customDataset : undefined);
      
      // 2. Classify user intent
      const intent = await gemini.classifyIntent(query, modelDefinition.model);

      let responseStream;
      let responseType: ResponseType;

      if (intent === Intent.CHIT_CHAT || (intent === Intent.QUERY_DOCUMENTS && context.length === 0)) {
        responseType = ResponseType.CHIT_CHAT;
        responseStream = await gemini.streamChitChatResponse(newHistory, modelDefinition.model);
      } else if (intent === Intent.GENERATE_CODE && mode !== AppMode.RESEARCH) {
        responseType = ResponseType.CODE_GENERATION;
        responseStream = await gemini.streamCodeGenerationResponse(newHistory, context, modelDefinition.model);
      } else {
        responseType = ResponseType.RAG;
        responseStream = await gemini.streamAiResponse(newHistory, context, mode, modelDefinition.model);
      }
      
      // 3. Stream the response
      let fullResponse = '';
      if (responseType === ResponseType.CODE_GENERATION) {
          // Code generation has a different streaming logic because it returns JSON
          for await (const chunk of responseStream) {
            fullResponse += chunk.text;
          }
          try {
            const parsedJson = JSON.parse(fullResponse);
            if (parsedJson.error) {
              setMessages(prev => {
                  const lastMsgIndex = prev.length - 1;
                  const newMessages = [...prev];
                  newMessages[lastMsgIndex] = {
                      ...newMessages[lastMsgIndex],
                      content: `Error: ${parsedJson.error}`,
                      responseType,
                  };
                  return newMessages;
              });
            } else {
              const { filePath, thought, newContent } = parsedJson;
              const sourceFile = allFiles.find(f => `${f.path}/${f.fileName}` === filePath);
              if (sourceFile) {
                const originalContent = await elastic.getFileContent(sourceFile, mode, mode === AppMode.CUSTOM ? customDataset : undefined);
                if (originalContent) {
                   const suggestion: CodeSuggestion = {
                      file: sourceFile,
                      thought,
                      originalContent,
                      suggestedContent: newContent,
                      status: 'pending',
                   };
                   setMessages(prev => {
                      const lastMsgIndex = prev.length - 1;
                      const newMessages = [...prev];
                      newMessages[lastMsgIndex] = {
                          ...newMessages[lastMsgIndex],
                          content: `I've prepared a suggestion to modify \`${filePath}\`.`,
                          suggestion,
                          responseType,
                      };
                      return newMessages;
                   });
                }
              } else {
                 setMessages(prev => {
                  const lastMsgIndex = prev.length - 1;
                  const newMessages = [...prev];
                  newMessages[lastMsgIndex] = {
                      ...newMessages[lastMsgIndex],
                      content: `Error: The model suggested a change for a file that could not be found: \`${filePath}\``,
                      responseType,
                  };
                  return newMessages;
                });
              }
            }
          } catch(e) {
            console.error("Error parsing code generation JSON:", e, "Raw content:", fullResponse);
            setMessages(prev => {
              const lastMsgIndex = prev.length - 1;
              const newMessages = [...prev];
              newMessages[lastMsgIndex] = {
                  ...newMessages[lastMsgIndex],
                  content: "Sorry, I encountered an error while generating the code suggestion. The response was not in the expected format.",
                  responseType,
              };
              return newMessages;
            });
          }
      } else {
        // Handle streaming for RAG and Chit-Chat
        for await (const chunk of responseStream) {
          fullResponse += chunk.text;
          setMessages(prev => {
            const lastMsgIndex = prev.length - 1;
            const newMessages = [...prev];
            newMessages[lastMsgIndex] = {
              ...newMessages[lastMsgIndex],
              content: fullResponse,
              sources: context.map(c => c.source),
              responseType,
            };
            return newMessages;
          });
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => {
        const lastMsgIndex = prev.length - 1;
        const newMessages = [...prev];
        newMessages[lastMsgIndex] = {
            ...newMessages[lastMsgIndex],
            content: "Sorry, I encountered an error. Please try again.",
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };


  // --- Render ---

  return (
    <div className="bg-slate-950 text-slate-100 h-screen w-screen flex flex-col font-sans">
      <Header 
        mode={mode} 
        onModeChange={handleModeChange}
        onNewChat={handleNewChat}
        onToggleFileSearch={handleToggleFileSearch}
        onFilesUploaded={handleFilesUploaded}
        onToggleEditedFiles={handleToggleEditedFiles}
      />
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 h-full">
            <ChatInterface 
                messages={messages} 
                isLoading={isLoading} 
                onSendMessage={handleSendMessage}
                onSelectSource={handleSelectSource}
                mode={mode}
                isCustomDatasetEmpty={mode === AppMode.CUSTOM && customDataset.length === 0}
                onFileUpload={handleFilesUploaded}
                onSuggestionAction={handleSuggestionAction}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
            />
        </div>

        {(isShowingFileSearch || isShowingEditedFiles) && (
          <div className="w-full max-w-sm border-l border-slate-700/50 bg-slate-900 h-full flex-shrink-0">
            {isShowingFileSearch && (
              <FileSearch 
                files={allFiles} 
                onClose={() => setIsShowingFileSearch(false)}
                onSelectFile={handleSelectSource}
              />
            )}
            {isShowingEditedFiles && (
              <EditedFilesViewer
                editedFiles={Array.from(editedFiles.values())}
                onClose={() => setIsShowingEditedFiles(false)}
                onSelectFile={(record) => setSelectedEditedFileRecord(record)}
              />
            )}
          </div>
        )}
      </main>
      
      {selectedFile && (
        <FileViewer 
          file={selectedFile}
          content={selectedFileContent}
          onClose={() => setSelectedFile(null)}
          mode={mode}
          viewType={selectedFileViewType}
        />
      )}

      {selectedEditedFileRecord && (
        <DiffViewerModal
          record={selectedEditedFileRecord}
          onClose={() => setSelectedEditedFileRecord(null)}
        />
      )}
    </div>
  );
};

export default App;
