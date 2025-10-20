import React, { useState, useCallback, useEffect } from 'react';
import { ChatMessage, MessageRole, Source, AppMode, ElasticResult, Intent, CodeSuggestion, ModelId, MODELS, ResponseType, FileViewType } from './types';
import { searchDocuments, getAllFiles, getFileContent, createDatasetFromFileList, updateFileContent } from './services/elasticService';
import { streamAiResponse, classifyIntent, streamChitChatResponse, streamCodeGenerationResponse, classifyFileContent } from './services/geminiService';
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import FileSearch from './components/FileSearch';
import FileViewer from './components/FileViewer';
import EditedFilesViewer from './components/EditedFilesViewer';
import DiffViewerModal from './components/DiffViewerModal';

const HISTORY_KEY = 'elastic-codemind-history';

export interface EditedFileRecord {
  file: Source;
  originalContent: string;
  currentContent: string;
}

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.CODEBASE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [allFiles, setAllFiles] = useState<Source[]>([]);
  const [isFileSearchVisible, setIsFileSearchVisible] = useState<boolean>(false);
  const [isEditedFilesVisible, setIsEditedFilesVisible] = useState<boolean>(false);
  const [editedFiles, setEditedFiles] = useState<Map<string, EditedFileRecord>>(new Map());
  const [selectedFile, setSelectedFile] = useState<Source | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  const [selectedFileViewType, setSelectedFileViewType] = useState<FileViewType | null>(null);
  const [customDataset, setCustomDataset] = useState<ElasticResult[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelId>(ModelId.GEMINI_FLASH_LITE);
  const [diffViewerRecord, setDiffViewerRecord] = useState<EditedFileRecord | null>(null);

  useEffect(() => {
    try {
      const savedState = localStorage.getItem(HISTORY_KEY);
      if (savedState) {
        const { messages: savedMessages, mode: savedMode, model: savedModel } = JSON.parse(savedState);
        if (savedMode !== AppMode.CUSTOM) {
          setMessages(savedMessages || []);
          setMode(savedMode || AppMode.CODEBASE);
          setSelectedModel(savedModel || ModelId.GEMINI_FLASH_LITE);
        }
      }
    } catch (error) {
      console.error("Failed to parse state from localStorage", error);
    }
  }, []);

  useEffect(() => {
    try {
      if (mode !== AppMode.CUSTOM) {
        const stateToSave = JSON.stringify({ messages, mode, model: selectedModel });
        localStorage.setItem(HISTORY_KEY, stateToSave);
      } else {
        localStorage.removeItem(HISTORY_KEY);
      }
    } catch (error) {
      console.error("Failed to save state to localStorage", error);
    }
  }, [messages, mode, selectedModel]);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const currentDataset = mode === AppMode.CUSTOM ? customDataset : undefined;
        const files = await getAllFiles(mode, currentDataset);
        setAllFiles(files);
      } catch (error) {
        console.error("Failed to fetch file list:", error);
      }
    };
    fetchFiles();
  }, [mode, customDataset]);

  const handleQueryDocuments = async (currentMessages: ChatMessage[]) => {
    setMessages(prev => [...prev, {
      role: MessageRole.MODEL,
      content: '',
      sources: [],
      responseType: ResponseType.RAG,
      modelId: selectedModel
    }]);

    const currentDataset = mode === AppMode.CUSTOM ? customDataset : undefined;
    const latestQuery = currentMessages[currentMessages.length -1].content;
    const searchResults = await searchDocuments(latestQuery, mode, currentDataset);
    const sources: Source[] = searchResults.map(r => r.source);

    const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
    const responseStream = await streamAiResponse(currentMessages, searchResults, mode, modelToUse);
    
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      setMessages(prev => prev.map((msg, index) => 
          index === prev.length - 1 
          ? { ...msg, content: msg.content + chunkText } 
          : msg
      ));
    }
    setMessages(prev => prev.map((msg, index) =>
        index === prev.length - 1
          ? { ...msg, sources }
          : msg
    ));
  };
  
  const handleChitChat = async (currentMessages: ChatMessage[]) => {
    setMessages(prev => [...prev, {
      role: MessageRole.MODEL,
      content: '',
      responseType: ResponseType.CHIT_CHAT,
      modelId: selectedModel
    }]);
    const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
    const responseStream = await streamChitChatResponse(currentMessages, modelToUse);
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      setMessages(prev => prev.map((msg, index) => 
          index === prev.length - 1 
          ? { ...msg, content: msg.content + chunkText } 
          : msg
      ));
    }
  };

  const handleCodeGeneration = async (currentMessages: ChatMessage[]) => {
    setMessages(prev => [...prev, {
      role: MessageRole.MODEL,
      content: 'Thinking about the file...',
      responseType: ResponseType.CODE_GENERATION,
      modelId: selectedModel
    }]);

    const currentDataset = mode === AppMode.CUSTOM ? customDataset : undefined;
    const latestQuery = currentMessages[currentMessages.length - 1].content;
    const searchResults = await searchDocuments(latestQuery, mode, currentDataset);
    
    if (searchResults.length === 0) {
        setMessages(prev => prev.map((msg, index) => 
          index === prev.length - 1 
          ? { ...msg, content: "I couldn't find any relevant files to modify for your request." } 
          : msg
        ));
        return;
    }
    
    const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
    const responseStream = await streamCodeGenerationResponse(currentMessages, searchResults, modelToUse);
    let responseJsonText = '';
    for await (const chunk of responseStream) {
        responseJsonText += chunk.text;
    }

    try {
        const responseObject = JSON.parse(responseJsonText);
        if (responseObject.error) {
            throw new Error(responseObject.error);
        }
        
        const fullPath = responseObject.filePath;
        const file = allFiles.find(f => `${f.path}/${f.fileName}` === fullPath);
        
        if (!file) {
            throw new Error(`The model suggested editing a file I couldn't find: ${fullPath}`);
        }

        const originalContent = await getFileContent(file, mode, currentDataset);

        if (originalContent === null) {
            throw new Error(`Could not fetch original content for ${file.fileName}.`);
        }

        const suggestion: CodeSuggestion = {
            file,
            thought: responseObject.thought,
            originalContent,
            suggestedContent: responseObject.newContent,
            status: 'pending',
        };

        setMessages(prev => prev.map((msg, index) => 
          index === prev.length - 1
            ? { ...msg, content: `I have a suggestion for \`${file.fileName}\`. Here are the changes:`, suggestion }
            : msg
        ));

    } catch (e) {
        console.error("Code generation parsing error:", e);
        let errorMessage = "Sorry, I couldn't generate the edit correctly.";
        if (e instanceof Error) {
            errorMessage = e.message;
        } else if (typeof e === 'object' && e !== null && 'message' in e) {
            errorMessage = String((e as { message: string }).message);
        } else if (typeof e === 'string') {
            errorMessage = e;
        }

        setMessages(prev => prev.map((msg, index) => 
          index === prev.length - 1 
          ? { ...msg, content: errorMessage } 
          : msg
        ));
    }
  };


  const handleSendMessage = useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    const userMessage: ChatMessage = { role: MessageRole.USER, content: query };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    try {
      const modelToUse = MODELS.find(m => m.id === selectedModel)?.model || MODELS[0].model;
      const intent = await classifyIntent(query, modelToUse);
      console.log("Detected Intent:", intent);

      switch (intent) {
        case Intent.GENERATE_CODE:
            await handleCodeGeneration(newMessages);
            break;
        case Intent.CHIT_CHAT:
            await handleChitChat(newMessages);
            break;
        case Intent.QUERY_DOCUMENTS:
        default:
            await handleQueryDocuments(newMessages);
            break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessageContent = error instanceof Error ? error.message : "An unknown error occurred.";
      setMessages(prev => [...prev, { role: MessageRole.MODEL, content: `Sorry, I encountered an error: ${errorMessageContent}` }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, mode, customDataset, allFiles, messages, selectedModel]);
  
  const handleModeChange = useCallback((newMode: AppMode) => {
    if (newMode === AppMode.CUSTOM) return; 
    setMode(newMode);
    setMessages([]);
    setAllFiles([]);
  }, []);

  const handleNewChat = useCallback(() => {
    setMessages([]);
  }, []);
  
  const handleFilesUploaded = useCallback(async (fileList: FileList) => {
    if (!fileList || fileList.length === 0) return;
    setIsLoading(true);
    try {
        const newDataset = await createDatasetFromFileList(fileList);
        setCustomDataset(newDataset);
        setMode(AppMode.CUSTOM);
        setMessages([]);
    } catch (error) {
        console.error("Error processing uploaded files:", error);
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleSuggestionAction = useCallback(async (messageIndex: number, action: 'accepted' | 'rejected') => {
    // FIX: Deep copy the message to prevent state mutation issues leading to circular dependency errors.
    const originalMessage = JSON.parse(JSON.stringify(messages[messageIndex]));
    if (!originalMessage || !originalMessage.suggestion) return;

    originalMessage.suggestion.status = action;

    const newMessages = [...messages];
    newMessages[messageIndex] = originalMessage;
    setMessages(newMessages);
      
    let followUpMessage: ChatMessage;
    let file: Source | null = null;

    if (action === 'accepted') {
        setIsLoading(true);
        const { originalContent, suggestedContent } = originalMessage.suggestion;
        file = originalMessage.suggestion.file;
        try {
            const success = await updateFileContent(file, suggestedContent, mode);
            if (!success) {
              throw new Error("The file could not be found or updated in the mock service.");
            }

            setEditedFiles(prev => {
                const newMap = new Map(prev);
                const existingRecord = newMap.get(file!.id);
                newMap.set(file!.id, {
                    file: file!,
                    originalContent: existingRecord ? existingRecord.originalContent : originalContent,
                    currentContent: suggestedContent,
                });
                return newMap;
            });

            const updatedFiles = await getAllFiles(mode, mode === AppMode.CUSTOM ? customDataset : undefined);
            setAllFiles(updatedFiles);
            followUpMessage = { 
              role: MessageRole.MODEL, 
              content: `Great! I've applied the changes to \`${originalMessage.suggestion.file.fileName}\`.`,
              editedFile: file
            };
        } catch(e) {
            console.error(`Failed to apply suggestion for ${file.fileName}:`, e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            followUpMessage = { role: MessageRole.MODEL, content: `Sorry, I failed to apply the changes to \`${file.fileName}\`. Reason: ${errorMessage}` };
        } finally {
            setIsLoading(false);
        }
    } else {
        followUpMessage = { role: MessageRole.MODEL, content: "Okay, I've discarded the changes." };
    }
    setMessages(prev => [...prev, followUpMessage]);

  }, [messages, mode, customDataset]);

  const handleToggleFileSearch = useCallback(() => {
    setIsFileSearchVisible(prev => !prev);
    if (isEditedFilesVisible) setIsEditedFilesVisible(false);
  }, [isEditedFilesVisible]);

  const handleToggleEditedFiles = useCallback(() => {
    setIsEditedFilesVisible(prev => !prev);
    if (isFileSearchVisible) setIsFileSearchVisible(false);
  }, [isFileSearchVisible]);

  const handleViewDiff = useCallback((record: EditedFileRecord) => {
    setDiffViewerRecord(record);
  }, []);

  const handleCloseDiffViewer = useCallback(() => {
      setDiffViewerRecord(null);
  }, []);

  const handleSelectFile = useCallback(async (file: Source) => {
    const editedRecord = editedFiles.get(file.id);
    if (editedRecord) {
        handleViewDiff(editedRecord);
    } else {
        setSelectedFile(file);
        setSelectedFileContent('Loading...');
        const currentDataset = mode === AppMode.CUSTOM ? customDataset : undefined;
        const content = await getFileContent(file, mode, currentDataset);
        setSelectedFileContent(content ?? 'Could not load file content.');

        if (mode === AppMode.CUSTOM && content) {
          try {
            const viewType = await classifyFileContent(content);
            setSelectedFileViewType(viewType);
          } catch (error) {
            console.error("Failed to classify file content:", error);
            setSelectedFileViewType('document'); 
          }
        }
    }
  }, [mode, customDataset, editedFiles, handleViewDiff]);

  const handleCloseFileViewer = useCallback(() => {
    setSelectedFile(null);
    setSelectedFileContent('');
    setSelectedFileViewType(null);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-gray-200 font-sans">
      <Header 
        mode={mode}
        onModeChange={handleModeChange}
        onNewChat={handleNewChat} 
        onToggleFileSearch={handleToggleFileSearch} 
        onFilesUploaded={handleFilesUploaded}
        onToggleEditedFiles={handleToggleEditedFiles}
      />
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 overflow-hidden">
           <ChatInterface 
              messages={messages} 
              isLoading={isLoading} 
              onSendMessage={handleSendMessage} 
              onSelectSource={handleSelectFile}
              mode={mode}
              isCustomDatasetEmpty={mode === AppMode.CUSTOM && customDataset.length === 0}
              onFileUpload={handleFilesUploaded}
              onSuggestionAction={handleSuggestionAction}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />
        </main>
        
        <div className={`absolute top-0 right-0 h-full w-full md:w-80 lg:w-96 z-20 transition-transform duration-300 ease-in-out ${isFileSearchVisible ? 'translate-x-0' : 'translate-x-full'}`}>
          <FileSearch files={allFiles} onClose={handleToggleFileSearch} onSelectFile={handleSelectFile}/>
        </div>

        <div className={`absolute top-0 right-0 h-full w-full md:w-80 lg:w-96 z-20 transition-transform duration-300 ease-in-out ${isEditedFilesVisible ? 'translate-x-0' : 'translate-x-full'}`}>
          <EditedFilesViewer
            editedFiles={Array.from(editedFiles.values())}
            onClose={handleToggleEditedFiles}
            onSelectFile={handleViewDiff}
          />
        </div>

        {selectedFile && (
          <FileViewer
            file={selectedFile}
            content={selectedFileContent}
            onClose={handleCloseFileViewer}
            mode={mode}
            viewType={selectedFileViewType}
          />
        )}

        {diffViewerRecord && (
            <DiffViewerModal
                record={diffViewerRecord}
                onClose={handleCloseDiffViewer}
            />
        )}
      </div>
    </div>
  );
};

export default App;