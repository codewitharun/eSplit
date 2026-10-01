// src/services/ai/assistantClient.ts
// Talks to esplit-backend's POST /ai/chat (routes/ai.js), which holds the
// AI provider API key (Gemini, Grok or Claude), checks the Firebase login and enforces the daily limit.
//
// One question can take a few round trips: the model may ask for a tool
// (e.g. get_spending_summary for September); we run it locally with
// runAssistantTool() on the user's own data and send back only that
// result, then the model writes the answer. The raw expense list never
// leaves the phone - only the specific results the model asked for.

import auth from '@react-native-firebase/auth';
import {API_BASE_URL} from '../../config/urls';
import {getGroupSnapshot, getUserGroups} from '../ledger/firestoreLedger';
import {AssistantData, runAssistantTool} from './assistantTools';

// Comes from src/config/urls.ts. To test against a local or Vercel-preview
// backend, temporarily set this to e.g. 'http://192.168.1.5:4000' - it must
// be API_BASE_URL in a release.
export const AI_BASE_URL = API_BASE_URL;

const MAX_ROUND_TRIPS = 6;
const REQUEST_TIMEOUT_MS = 30000;

type ContentBlock =
  | {type: 'text'; text: string}
  | {type: 'tool_use'; id: string; name: string; input: any}
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

// A finished question/answer, kept as plain text so follow-ups ("and last
// month?") have context without re-sending old tool results.
export interface ChatTurn {
  question: string;
  answer: string;
}

export class AssistantError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// Everything the tools need: every group the user is in, with its
// members, expenses and settlements. Read-only, same one-time reads the
// Groups dashboard already does.
export async function loadAssistantData(uid: string): Promise<AssistantData> {
  const groups = await getUserGroups(uid);
  const snapshots = await Promise.all(
    groups.map(async group => ({group, ...(await getGroupSnapshot(group.id))})),
  );
  return {uid, groups: snapshots};
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

async function postChat(
  messages: ApiMessage[],
  userName: string,
): Promise<{content: ContentBlock[]; stopReason: string; remaining?: number}> {
  const user = auth().currentUser;
  if (!user) {
    throw new AssistantError('auth', 'Please sign in again.');
  }
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${AI_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages,
        context: {today: localToday(), userName},
      }),
      signal: controller.signal,
    });
  } catch (error) {
    throw new AssistantError(
      'network',
      'Couldn’t reach the assistant. Check your internet and try again.',
    );
  } finally {
    clearTimeout(timer);
  }
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    // fall through to the generic error below
  }
  if (!response.ok) {
    throw new AssistantError(
      body?.error || 'server',
      body?.message || 'The assistant couldn’t answer right now.',
    );
  }
  return body;
}

export async function askAssistant(params: {
  question: string;
  history: ChatTurn[];
  data: AssistantData;
  userName: string;
  onStatus?: (status: string) => void;
}): Promise<{answer: string; remaining?: number}> {
  const messages: ApiMessage[] = [];
  params.history.slice(-6).forEach(turn => {
    messages.push({role: 'user', content: turn.question});
    messages.push({role: 'assistant', content: turn.answer});
  });
  messages.push({role: 'user', content: params.question});

  let remaining: number | undefined;
  for (let i = 0; i < MAX_ROUND_TRIPS; i++) {
    const reply = await postChat(messages, params.userName);
    if (typeof reply.remaining === 'number') {
      remaining = reply.remaining;
    }
    const blocks = Array.isArray(reply.content) ? reply.content : [];
    messages.push({role: 'assistant', content: blocks});

    const toolUses = blocks.filter(
      (b): b is Extract<ContentBlock, {type: 'tool_use'}> =>
        b.type === 'tool_use',
    );
    if (reply.stopReason !== 'tool_use' || toolUses.length === 0) {
      const answer = blocks
        .filter(
          (b): b is Extract<ContentBlock, {type: 'text'}> => b.type === 'text',
        )
        .map(b => b.text)
        .join('\n')
        .trim();
      return {
        answer: answer || 'Sorry, I couldn’t come up with an answer to that.',
        remaining,
      };
    }

    params.onStatus?.('Checking your expenses…');
    messages.push({
      role: 'user',
      content: toolUses.map(t => {
        let result: unknown;
        let isError = false;
        try {
          result = runAssistantTool(t.name, t.input, params.data);
        } catch (error: any) {
          isError = true;
          result = {error: error?.message || 'Tool failed'};
        }
        return {
          type: 'tool_result' as const,
          tool_use_id: t.id,
          content: JSON.stringify(result),
          ...(isError ? {is_error: true} : {}),
        };
      }),
    });
  }
  throw new AssistantError(
    'too_long',
    'That question needed too many steps - try asking it more simply.',
  );
}
