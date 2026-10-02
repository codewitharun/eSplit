// src/component/assistant/AssistantChat.tsx
// The "Ask EzySplit" chat body: first-use privacy notice, suggested
// questions, messages and the input bar. Rendered inside AssistantOrb's
// genie panel. See src/services/ai/assistantClient.ts for how answers are
// produced and what data leaves the phone. Read-only: never writes data.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {SendHorizontal, Sparkles} from 'lucide-react-native';
import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text, TextInput} from '../ui/AppText';
import {
  AssistantError,
  askAssistant,
  loadAssistantData,
} from '../../services/ai/assistantClient';
import {AssistantData} from '../../services/ai/assistantTools';
import {useAiAccessStore} from '../../store/useAiAccessStore';
import {
  AssistantMessage,
  useAssistantStore,
} from '../../store/useAssistantStore';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';
import TypewriterText from './TypewriterText';
import {currentUser} from '../../data/firebase';

const CONSENT_KEY = 'ezysplit.aiAssistantConsent.v1';
// Data older than this is re-read before the next question, so an
// expense added a moment ago is included.
const DATA_MAX_AGE_MS = 60 * 1000;
let dataCache: {uid: string; data: AssistantData; loadedAt: number} | null =
  null;

function suggestionsFor(groupName?: string): string[] {
  const base = [
    'How much did I spend this month?',
    'My top 5 expenses this month',
    'Spending by category, last 3 months',
    'Who owes me money?',
  ];
  return groupName
    ? [
        `How much have I spent in ${groupName}?`,
        `Biggest expenses in ${groupName}`,
        ...base.slice(0, 3),
      ]
    : [...base, 'Which group do I spend the most in?'];
}

interface Props {
  groupName?: string;
  bottomInset: number;
}

const AssistantChat: React.FC<Props> = ({groupName, bottomInset}) => {
  const user = currentUser();
  const userName = (user?.displayName || '').split(' ')[0] || 'there';
  const store = useAssistantStore();
  const [consent, setConsent] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<AssistantMessage>>(null);

  useEffect(() => {
    if (user) {
      useAssistantStore.getState().ensureUser(user.uid);
    }
    AsyncStorage.getItem(CONSENT_KEY)
      .then(v => setConsent(v === 'yes'))
      .catch(() => setConsent(false));
  }, [user]);

  const acceptConsent = () => {
    haptics.tap();
    setConsent(true);
    AsyncStorage.setItem(CONSENT_KEY, 'yes').catch(() => {});
  };

  const getData = async (uid: string): Promise<AssistantData> => {
    if (
      dataCache &&
      dataCache.uid === uid &&
      Date.now() - dataCache.loadedAt < DATA_MAX_AGE_MS
    ) {
      return dataCache.data;
    }
    const data = await loadAssistantData(uid);
    dataCache = {uid, data, loadedAt: Date.now()};
    return data;
  };

  const send = async (text: string) => {
    const question = text.trim();
    const s = useAssistantStore.getState();
    if (!question || s.busy || !user) {
      return;
    }
    haptics.tap();
    setInput('');
    s.append({role: 'user', text: question});
    s.setBusy(true, 'Thinking…');
    // "Thinking" feel: soft haptic ticks at irregular intervals, like
    // someone typing, until the answer arrives (Android only - see
    // haptics.tick).
    let thinkingTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleTick = () => {
      thinkingTimer = setTimeout(() => {
        haptics.tick();
        scheduleTick();
      }, 180 + Math.random() * 520);
    };
    scheduleTick();
    try {
      const data = await getData(user.uid);
      const result = await askAssistant({
        question,
        history: useAssistantStore.getState().history,
        data,
        userName,
        onStatus: status => useAssistantStore.getState().setBusy(true, status),
      });
      const after = useAssistantStore.getState();
      after.addTurn({question, answer: result.answer});
      if (typeof result.remaining === 'number') {
        after.setRemaining(result.remaining);
      }
      if (thinkingTimer) {
        clearTimeout(thinkingTimer);
        thinkingTimer = null;
      }
      haptics.success();
      after.append({role: 'assistant', text: result.answer, animate: true});
    } catch (error: any) {
      if (thinkingTimer) {
        clearTimeout(thinkingTimer);
        thinkingTimer = null;
      }
      const after = useAssistantStore.getState();
      if (error instanceof AssistantError && error.code === 'limit') {
        after.setRemaining(0);
        haptics.warning();
      } else if (
        error instanceof AssistantError &&
        error.code === 'no_access'
      ) {
        // Access was switched off in the admin panel - the orb disappears
        // once this panel closes.
        useAiAccessStore.getState().revoke();
        haptics.warning();
      } else {
        haptics.error();
      }
      after.append({
        role: 'assistant',
        text:
          error instanceof AssistantError
            ? error.message
            : 'Something went wrong loading your expenses. Please try again.',
        isError: true,
      });
    } finally {
      if (thinkingTimer) {
        clearTimeout(thinkingTimer);
      }
      useAssistantStore.getState().setBusy(false);
    }
  };

  if (consent === null) {
    return <ActivityIndicator color={theme.color.teal} style={styles.loader} />;
  }

  if (!consent) {
    return (
      <View style={[styles.consent, {paddingBottom: bottomInset + 16}]}>
        <Sparkles size={26} color={theme.color.teal} />
        <Text style={styles.consentTitle}>
          Ask anything about your spending
        </Text>
        <Text style={styles.consentText}>
          “How much did I spend on food last month?” “Who owes me money?” The
          assistant answers using your own EzySplit expenses.
        </Text>
        <Text style={styles.consentText}>
          To answer, your question and the expense details it needs (amounts,
          categories, dates, descriptions, group and member names) are sent to
          our server and to our AI provider (currently Google Gemini). They’re
          used only to answer you and aren’t saved by EzySplit.
        </Text>
        <Text style={styles.consentText}>
          AI can make mistakes - double-check anything important in the app.
        </Text>
        <TouchableOpacity style={styles.consentBtn} onPress={acceptConsent}>
          <Text style={styles.consentBtnText}>Got it, let’s go</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        ref={listRef}
        data={store.messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({animated: true})
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Hi {userName}!</Text>
            <Text style={styles.emptyText}>
              Ask about your spending, categories, groups or balances.
            </Text>
            <View style={styles.suggestions}>
              {suggestionsFor(groupName).map(s => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestion}
                  disabled={store.busy}
                  onPress={() => send(s)}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        renderItem={({item}) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.userBubble : styles.aiBubble,
              item.isError && styles.errorBubble,
            ]}>
            {item.animate ? (
              <TypewriterText
                text={item.text}
                style={styles.bubbleText}
                onDone={() =>
                  useAssistantStore.getState().markAnimated(item.id)
                }
              />
            ) : (
              <Text selectable style={styles.bubbleText}>
                {item.text}
              </Text>
            )}
          </View>
        )}
        ListFooterComponent={
          store.busy ? (
            <View style={[styles.bubble, styles.aiBubble, styles.typing]}>
              <ActivityIndicator size="small" color={theme.color.teal} />
              <Text style={styles.typingText}>{store.status}</Text>
            </View>
          ) : null
        }
      />

      <View style={[styles.inputBar, {paddingBottom: bottomInset + 10}]}>
        {store.remaining !== null && (
          <Text style={styles.remaining}>
            {store.remaining > 0
              ? `${store.remaining} question${
                  store.remaining === 1 ? '' : 's'
                } left today`
              : 'Daily limit reached - back tomorrow'}
          </Text>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your expenses…"
            placeholderTextColor={theme.color.inkFaint}
            multiline
            maxLength={300}
            editable={!store.busy}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || store.busy) && styles.sendBtnDisabled,
            ]}
            disabled={!input.trim() || store.busy}
            onPress={() => send(input)}
            accessibilityLabel="Send">
            <SendHorizontal size={18} color={theme.color.onAccent} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  loader: {marginTop: 40},
  consent: {padding: 20, gap: 12},
  consentTitle: {
    fontFamily: DisplayFont.bold,
    color: theme.color.ink,
    fontSize: moderateScale(17),
    fontWeight: '700',
  },
  consentText: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkSoft,
    fontSize: moderateScale(13.5),
    lineHeight: moderateScale(19),
  },
  consentBtn: {
    marginTop: 6,
    backgroundColor: theme.color.blue,
    borderRadius: theme.radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  consentBtnText: {
    color: theme.color.ink,
    fontFamily: BodyFont.bold,
    fontWeight: '700',
    fontSize: moderateScale(14.5),
  },
  list: {padding: 16, paddingBottom: 8, flexGrow: 1},
  empty: {alignItems: 'center', paddingTop: 8, gap: 8},
  emptyTitle: {
    fontFamily: DisplayFont.bold,
    color: theme.color.ink,
    fontSize: moderateScale(18),
    fontWeight: '700',
  },
  emptyText: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkSoft,
    fontSize: moderateScale(13.5),
    textAlign: 'center',
    marginBottom: 8,
  },
  suggestions: {alignSelf: 'stretch', gap: 8},
  suggestion: {
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: theme.radius.md,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  suggestionText: {
    fontFamily: BodyFont.regular,
    color: theme.color.ink,
    fontSize: moderateScale(14),
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: theme.color.blue,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderBottomLeftRadius: 4,
  },
  errorBubble: {borderColor: theme.color.rose},
  bubbleText: {
    fontFamily: BodyFont.regular,
    color: theme.color.ink,
    fontSize: moderateScale(14.5),
    lineHeight: moderateScale(20.5),
  },
  typing: {flexDirection: 'row', alignItems: 'center', gap: 8},
  typingText: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkSoft,
    fontSize: moderateScale(13),
  },
  inputBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
  },
  remaining: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkFaint,
    fontSize: moderateScale(11.5),
    textAlign: 'center',
    marginBottom: 6,
  },
  inputRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.color.ink,
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(15),
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.color.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {opacity: 0.4},
});

export default AssistantChat;
