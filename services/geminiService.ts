import { GoogleGenAI, Content, Type } from "@google/genai";
import { ElasticResult, AppMode, Intent, ChatMessage, FileViewType } from '../types';

const getSystemInstruction = (mode: AppMode): string => {
  switch (mode) {
    case AppMode.RESEARCH:
      return `You are a world-class research assistant. Your task is to answer the user's question based *only* on the context provided with the latest user message.
- Analyze the provided abstracts carefully.
- Synthesize information to provide a clear, concise, and accurate answer.
- If the context is insufficient, state that clearly.
- Do not use knowledge outside of the provided context.`;
    case AppMode.SUPPORT:
      return `You are a highly-skilled customer support specialist. Your task is to resolve the user's issue based *only* on the context provided with the latest user message.
- Analyze the provided tickets to identify the problem and solution.
- Formulate a helpful and empathetic response to the user.
- If no relevant tickets are found, suggest escalating the issue.
- Do not use knowledge outside of the provided context.`;
    case AppMode.CUSTOM:
        return `You are a helpful and intelligent assistant. Your task is to answer the user's question based *only* on the context provided with the latest user message.
- Analyze the provided document snippets carefully.
- Provide a clear, concise, and accurate answer based exclusively on the given text.
- Format your response in Markdown. If you include content from the source, use code blocks for easy reading.
- If the context is insufficient to answer the question, you must state that the answer cannot be found in the provided documents.
- Do not use any external knowledge.`;
    case AppMode.CODEBASE:
    default:
      return `You are "Elastic CodeMind", a world-class AI programming assistant.
Your task is to answer the user's question based *only* on the context provided with the latest user message.
- Analyze the provided code snippets and file paths carefully.
- Provide a clear, concise, and accurate answer.
- Format your response in Markdown, using code blocks for any code examples.
- If the context is insufficient, state that clearly.
- Do not invent information or use knowledge outside of the provided context.`;
  }
};

// Helper to convert our ChatMessage array to Gemini's Content array
const buildConversationHistory = (history: ChatMessage[]): Content[] => {
    return history.map(msg => {
        let content = msg.content;
        // Prepend metadata to model's past responses to give AI more context
        if (msg.role === 'model' && msg.responseType) {
            content = `[This was a ${msg.responseType} response]\n\n${msg.content}`;
        }
        return {
            role: msg.role,
            parts: [{ text: content }]
        };
    });
};

export const classifyFileContent = async (content: string): Promise<FileViewType> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Updated model name to a supported model from the guidelines.
    const model = 'gemini-flash-lite-latest';

    const prompt = `You are a file content classifier. Your task is to determine if the provided text is primarily a programming script or a natural language document.

Respond with only one of the two words: 'code' or 'document'.

- 'code': for source code files like .js, .ts, .py, .java, JSON, YAML, etc.
- 'document': for text files like .md, .txt, articles, papers, tickets, etc.

Here is the content:
---
${content.substring(0, 4000)}
---
Classification:`;

    try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        const classification = response.text.trim().toLowerCase() as FileViewType;
        if (classification === 'code' || classification === 'document') {
            console.log(`[Gemini] Classified content as: ${classification}`);
            return classification;
        }
        console.warn(`[Gemini] Unknown classification: ${classification}, falling back to 'document'`);
        return 'document';
    } catch (error) {
        console.error("File content classification error:", error);
        return 'document';
    }
};


export const classifyIntent = async (userQuery: string, model: string): Promise<Intent> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `You are an advanced intent classifier for an AI assistant that helps with documents and code. Your job is to determine the user's primary intent.

Classify the user's message into one of three categories:
1. 'query_documents': The user is asking for information, asking a question, requesting a summary, or looking for something within the provided context.
2. 'generate_code': The user is asking to write new code, modify existing code, refactor, add features, fix bugs, or asking to edit or rewrite the content of a document.
3. 'chit_chat': The user is making a social comment, greeting, expressing gratitude, or saying something not related to the documents or code.

Respond with only one of the three category names: 'query_documents', 'generate_code', or 'chit_chat'.

User: "How does the authentication work?"
Assistant: query_documents

User: "Hey there"
Assistant: chit_chat

User: "Add a logout function to the auth service."
Assistant: generate_code

User: "Can you refactor the user model to include a new field?"
Assistant: generate_code

User: "That's awesome, thanks a lot!"
Assistant: chit_chat

User: "Rewrite the abstract for the BERT paper to be more concise."
Assistant: generate_code

User: "What's the difference between BERT and the Transformer model?"
Assistant: query_documents

User: "${userQuery}"
Assistant:`;

    try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        const intent = response.text.trim() as Intent;
        if (Object.values(Intent).includes(intent)) {
            return intent;
        }
        return Intent.UNKNOWN;
    } catch (error) {
        console.error("Intent classification error:", error);
        return Intent.QUERY_DOCUMENTS; // Fallback to default
    }
};

export const streamChitChatResponse = async (history: ChatMessage[], model: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const conversationHistory = buildConversationHistory(history);

    const systemInstruction = `You are a helpful and friendly assistant whose main purpose is to answer questions about a specific set of documents.
The user is not asking a question about the documents, but is making a social comment.
Respond politely and conversationally. If appropriate, gently guide the user back to your main purpose.`;

    try {
        return await ai.models.generateContentStream({
          model,
          contents: conversationHistory,
          config: {
            systemInstruction
          }
        });
    } catch (error) {
        console.error("Gemini API error (Chit-Chat):", error);
        throw new Error("There was an error communicating with the Gemini API.");
    }
};

export const streamCodeGenerationResponse = async (history: ChatMessage[], context: ElasticResult[], model: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const conversationHistory = buildConversationHistory(history);
    const lastUserMessage = conversationHistory.pop();

    if (!lastUserMessage) throw new Error("Cannot generate code from empty history.");

    const contextString = context.map(result => `
---
File: ${result.source.path}/${result.source.fileName}
Content:
\`\`\`
${result.contentSnippet.trim()}
\`\`\`
---
    `).join('\n');

    const codeGenPrompt = `
**CONVERSATION HISTORY:**
${history.slice(0, -1).map(m => `${m.role}: ${m.content}`).join('\n')}

**SEARCH CONTEXT FOR CURRENT REQUEST:**
${contextString}

**USER'S CURRENT REQUEST:**
${lastUserMessage.parts[0].text}
`;
    
    conversationHistory.push({ role: 'user', parts: [{ text: codeGenPrompt }] });

    const systemInstruction = `You are an expert AI assistant, skilled in both programming and content editing. Your task is to modify a source file based on the user's request, using the provided context and conversation history.

You MUST follow these rules exactly:
1.  Respond with a single, valid JSON object. Do not add any text, markdown, or comments before or after the JSON object.
2.  The JSON object must have this exact structure: { "filePath": string, "thought": string, "newContent": string } or { "error": string }.
3.  'filePath': Identify the single most relevant file from the context to modify. The 'filePath' value must exactly match the path and filename from the context (e.g., "src/lib/auth/auth.ts").
4.  'thought': Provide a brief, one-sentence explanation of the changes you are making.
5.  'newContent': This field MUST contain the COMPLETE and UNALTERED content of the file with the requested modifications. It must be a single string.
6.  DO NOT use diff format (e.g., lines starting with '+' or '-').
7.  DO NOT return only the changed snippet. Return the ENTIRE file.
8.  If you cannot fulfill the request or the context is insufficient, respond with a JSON object containing an 'error' field. Example: { "error": "I could not find a relevant file to modify in the provided context." }`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            filePath: { type: Type.STRING },
            thought: { type: Type.STRING },
            newContent: { type: Type.STRING },
            error: { type: Type.STRING, nullable: true },
        },
    };


    try {
        return await ai.models.generateContentStream({
            model,
            contents: conversationHistory,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema,
            }
        });
    } catch (error) {
        console.error("Gemini API error (Code Generation):", error);
        throw new Error("There was an error communicating with the Gemini API for code generation.");
    }
}


export const streamAiResponse = async (history: ChatMessage[], context: ElasticResult[], mode: AppMode, model: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const conversationHistory = buildConversationHistory(history);
  const lastUserMessage = conversationHistory.pop();

  if (!lastUserMessage) throw new Error("Cannot get AI response from empty history.");

  const contextString = context.map(result => `
---
File: ${result.source.path}/${result.source.fileName}
Relevance Score: ${result.score}

\`\`\`
${result.contentSnippet.trim()}
\`\`\`
---
  `).join('\n');

  const finalUserPrompt = `
**SEARCH CONTEXT:**
${contextString}

**USER'S QUESTION:**
${lastUserMessage.parts[0].text}
  `;

  conversationHistory.push({ role: 'user', parts: [{ text: finalUserPrompt }] });

  try {
    const responseStream = await ai.models.generateContentStream({
      model,
      contents: conversationHistory,
      config: {
        systemInstruction: getSystemInstruction(mode),
      }
    });
    return responseStream;
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("There was an error communicating with the Gemini API.");
  }
};
