import { ElasticResult, Source, AppMode } from '../types';

// --- MOCK DATASETS ---

let mockCodebase: ElasticResult[] = [
  {
    source: { id: 'codebase-auth', fileName: 'auth.ts', path: 'src/lib/auth' },
    contentSnippet: `
import { NextApiRequest, NextApiResponse } from 'next';
import { IronSession, getIronSession } from 'iron-session';
import { SiweMessage, generateNonce } from 'siwe';

export const sessionOptions: IronSessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD as string,
  cookieName: 'myapp-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

export async function verifyLogin(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession(req, res, sessionOptions);
  const { message, signature } = req.body;
  const siweMessage = new SiweMessage(message);
  try {
    const fields = await siweMessage.verify({ signature });
    if (fields.data.nonce !== session.nonce) {
      return res.status(422).json({ message: 'Invalid nonce.' });
    }
    session.siwe = fields.data;
    await session.save();
    res.json({ ok: true });
  } catch (_error) {
    res.json({ ok: false });
  }
}
    `,
    score: 0.95
  },
  {
    source: { id: 'codebase-user-model', fileName: 'user.model.ts', path: 'src/models' },
    contentSnippet: `
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true },
  username: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
    `,
    score: 0.88
  },
  {
    source: { id: 'codebase-api', fileName: 'api.ts', path: 'src/services' },
    contentSnippet: `
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const fetchUserProfile = async (userId: string) => {
  const response = await api.get(\`/users/\${userId}\`);
  return response.data;
};

export const updateUserProfile = async (userId: string, data: any) => {
  const response = await api.put(\`/users/\${userId}\`, data);
  return response.data;
};
    `,
    score: 0.75
  },
];

const mockResearchPapers: ElasticResult[] = [
    {
        source: { id: 'research-attention', fileName: 'Attention Is All You Need', path: 'Vaswani et al., 2017' },
        contentSnippet: `Abstract: The dominant sequence transduction models are based on complex recurrent or convolutional neural networks in an encoder-decoder configuration. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.`,
        score: 0.98
    },
    {
        source: { id: 'research-bert', fileName: 'BERT: Pre-training of Deep Bidirectional Transformers', path: 'Devlin et al., 2018' },
        contentSnippet: `Abstract: We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers. As a result, the pre-trained BERT model can be fine-tuned with just one additional output layer to create state-of-the-art models for a wide range of tasks, such as question answering and language inference, without substantial task-specific architecture modifications.`,
        score: 0.95
    }
];

const mockSupportTickets: ElasticResult[] = [
    {
        source: { id: 'support-login', fileName: 'Login Issue', path: 'Ticket #48151' },
        contentSnippet: `User: I'm unable to log in. I keep getting an "Invalid Credentials" error, but I'm sure my password is correct. I've tried resetting it, but the link seems to be expired. Can you help?\n\nAgent: It seems there was an issue with our password reset token expiration. I've manually generated a new, 24-hour reset link for you. Please check your email.`,
        score: 0.92
    },
    {
        source: { id: 'support-billing', fileName: 'Billing Discrepancy', path: 'Ticket #62342' },
        contentSnippet: `User: Hi, I was charged twice for my subscription this month. My account ID is user-123. Please refund the extra charge.\n\nAgent: Apologies for the error. I've located the duplicate transaction and issued a full refund. It should appear in your account within 3-5 business days. We've also fixed the bug that caused this.`,
        score: 0.89
    }
];

const getDatasets = () => ({
  [AppMode.CODEBASE]: mockCodebase,
  [AppMode.RESEARCH]: mockResearchPapers,
  [AppMode.SUPPORT]: mockSupportTickets,
  [AppMode.CUSTOM]: [], // Custom dataset is handled dynamically
});

const isTextFile = (file: File): boolean => {
    // Check by MIME type first
    if (file.type.startsWith('text/') || file.type === 'application/json' || file.type === '') {
        return true;
    }
    // Fallback to checking file extension for common text/code formats
    const textExtensions = [
        '.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.txt', '.py', '.java', '.html', 
        '.css', '.scss', '.yml', '.yaml', '.sh', '.sample', '.xml', '.csv'
    ];
    return textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
};

export const createDatasetFromFileList = (fileList: FileList): Promise<ElasticResult[]> => {
  return new Promise((resolve, reject) => {
    const results: ElasticResult[] = [];
    let filesToProcess = fileList.length;

    if (filesToProcess === 0) {
      resolve([]);
      return;
    }

    Array.from(fileList).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const fullPath = (file as any).webkitRelativePath || file.name;
        const lastSlash = fullPath.lastIndexOf('/');
        const path = lastSlash === -1 ? '' : fullPath.substring(0, lastSlash);
        const fileName = lastSlash === -1 ? fullPath : fullPath.substring(lastSlash + 1);
        
        results.push({
          source: {
            id: `custom-${fullPath}-${file.size}-${file.lastModified}`,
            fileName: fileName,
            path: path,
          },
          contentSnippet: content,
          score: 1.0,
        });
        filesToProcess--;
        if (filesToProcess === 0) {
          resolve(results);
        }
      };
      reader.onerror = (error) => {
        console.error("Error reading file:", file.name, error);
        filesToProcess--;
        if (filesToProcess === 0) {
          resolve(results); // Resolve with what we have
        }
      };

      if (isTextFile(file)) {
        reader.readAsText(file);
      } else {
        console.warn(`Skipping non-text file: ${file.name} (${file.type})`);
        filesToProcess--;
        if (filesToProcess === 0) {
          resolve(results);
        }
      }
    });
  });
};


export const searchDocuments = (query: string, mode: AppMode, customData?: ElasticResult[]): Promise<ElasticResult[]> => {
  console.log(`[Elastic Mock] Searching for: "${query}" in ${mode}`);
  const dataset = customData || getDatasets()[mode];

  return new Promise(resolve => {
    setTimeout(() => {
      const lowerCaseQuery = query.toLowerCase();
      const keywords = lowerCaseQuery.split(' ').filter(word => word.length > 2);

      const results = dataset.filter(doc => {
        const content = (doc.source.fileName + ' ' + doc.contentSnippet).toLowerCase();
        return keywords.some(keyword => content.includes(keyword));
      });

      console.log(`[Elastic Mock] Found ${results.length} results.`);
      resolve(results);
    }, 500);
  });
};

export const getFileContent = (source: Source, mode: AppMode, customData?: ElasticResult[]): Promise<string | null> => {
    console.log(`[Elastic Mock] Fetching content for: "${source.fileName}" (id: ${source.id}) in ${mode}`);
    const dataset = customData || getDatasets()[mode];
    return new Promise(resolve => {
        setTimeout(() => {
            const doc = dataset.find(d => d.source.id === source.id);
            resolve(doc ? doc.contentSnippet.trim() : null);
        }, 100);
    });
};

export const getAllFiles = (mode: AppMode, customData?: ElasticResult[]): Promise<Source[]> => {
  console.log(`[Elastic Mock] Fetching all files for ${mode}.`);
  const dataset = customData || getDatasets()[mode];

  return new Promise(resolve => {
    setTimeout(() => {
      const uniqueFiles = new Map<string, Source>();
      dataset.forEach(doc => {
        if (!uniqueFiles.has(doc.source.id)) {
          uniqueFiles.set(doc.source.id, doc.source);
        }
      });
      const allFiles = Array.from(uniqueFiles.values());
      console.log(`[Elastic Mock] Found ${allFiles.length} unique files.`);
      resolve(allFiles);
    }, 200);
  });
};

export const updateFileContent = (source: Source, newContent: string, mode: AppMode): Promise<boolean> => {
    console.log(`[Elastic Mock] Updating content for: "${source.fileName}" (id: ${source.id}) in ${mode}`);
    return new Promise(resolve => {
        // This is a mock, so we're updating the in-memory dataset.
        // In a real app, this would be an API call to Elastic.
        if (mode === AppMode.CODEBASE) {
            const index = mockCodebase.findIndex(doc => doc.source.id === source.id);
            if (index !== -1) {
                mockCodebase[index].contentSnippet = newContent;
                console.log(`[Elastic Mock] Updated ${source.fileName} successfully.`);
                resolve(true);
                return;
            }
        }
        // Can add logic for other modes if needed
        console.error(`[Elastic Mock] Could not find file to update with id: ${source.id}`);
        resolve(false);
    });
};