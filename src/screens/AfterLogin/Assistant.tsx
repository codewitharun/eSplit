// src/screens/AfterLogin/Assistant.tsx
// "Ask EzySplit" - an AI chat about the user's own spending. See
// src/services/ai/assistantClient.ts for how it works and what data leaves
// the phone. Read-only: nothing on this screen writes to Firestore.

import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import {useNavigation} from '@react-navigation/native';
import {ChevronLeft, SendHorizontal, Sparkles} from 'lucide-react-native';
import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GlassCard from '../../component/glass/GlassCard';
import {
  AssistantError,
  ChatTurn,
  askAssistant,
  loadAssistantData,
} from '../../services/ai/assistantClient';
import {AssistantData} from '../../services/ai/assistantTools';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';

const CONSENT_KEY = 'ezysplit.aiAssistantConsent.v1';
// Data older than this is re-read before the next question, so an
// expense added a moment ago is included.
const DATA_MAX_AGE_MS = 60 * 1000;

const SUGGESTIONS = [
  'How much did I spend this month?',
  'My top 5 expenses this month',
  'Spending by category, last 3 months',
  'Who owes me money?',
  'Which group do I spend the most in?',
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
}

const AssistantScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const user = auth().currentUser;
  const userName = (user?.displayName || '').split(' ')[0] || 'there';

  const [consent, setConsent] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const historyRef = useRef<ChatTurn[]>([]);
  const dataRef = useRef<{data: AssistantData; loadedAt: number} | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    AsyncStorage.getItem(CONSENT_KEY)
      .then(v => setConsent(v === 'yes'))
      .catch(() => setConsent(false));
  }, []);

  const acceptConsent = () => {
    haptics.tap();
    setConsent(true);
    AsyncStorage.setItem(CONSENT_KEY, 'yes').catch(() => {});
  };

  const getData = async (): Promise<AssistantData> => {
    const cached = dataRef.current;
    if (cached && Date.now() - cached.loadedAt < DATA_MAX_AGE_MS) {
      return cached.data;
    }
    const data = await loadAssistantData(user!.uid);
    dataRef.current = {data, loadedAt: Date.now()};
    return data;
  };

  const append = (m: Omit<Message, 'id'>) =>
    setMessages(prev => [...prev, {...m, id: `${Date.now()}_${prev.length}`}]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy || !user) {
      return;
    }
    haptics.tap();
    setInput('');
    append({role: 'user', text: question});
    setBusy(true);
    setStatus('Thinking…');
    try {
      const data = await getData();
      const result = await askAssistant({
        question,
        history: historyRef.current,
        data,
        userName,
        onStatus: setStatus,
      });
      historyRef.current = [
        ...historyRef.current,
        {question, answer: result.answer},
      ].slice(-6);
      if (typeof result.remaining === 'number') {
        setRemaining(result.remaining);
      }
      append({role: 'assistant', text: result.answer});
    } catch (error: any) {
      if (error instanceof AssistantError && error.code === 'limit') {
        setRemaining(0);
      }
      append({
        role: 'assistant',
        text:
          error instanceof AssistantError
            ? error.message
            : 'Something went wrong loading your expenses. Please try again.',
        isError: true,
      });
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  const header = (
    <View style={[styles.header, {paddingTop: insets.top + 12}]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        accessibilityLabel="Back"
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        style={styles.backBtn}>
        <ChevronLeft size={22} color={theme.color.ink} />
      </TouchableOpacity>
      <View style={styles.headerMid}>
        <Text style={styles.headerTitle}>Ask EzySplit</Text>
        <Text style={styles.headerSub}>AI · answers from your expenses</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (consent === null) {
    return (
      <View style={styles.flex}>
        {header}
        <ActivityIndicator color={theme.color.blue} style={styles.loader} />
      </View>
    );
  }

  if (!consent) {
    return (
      <View style={styles.flex}>
        {header}
        <View style={styles.consentWrap}>
          <GlassCard style={styles.consentCard}>
            <Sparkles size={28} color={theme.color.teal} />
            <Text style={styles.consentTitle}>
              Ask anything about your spending
            </Text>
            <Text style={styles.consentText}>
              “How much did I spend on food last month?” “Who owes me money?”
              The assistant answers using your own EzySplit expenses.
            </Text>
            <Text style={styles.consentText}>
              To answer, your question and the expense details it needs
              (amounts, categories, dates, descriptions, group and member names)
              are sent to our server and to Anthropic’s Claude AI. They’re used
              only to answer you and aren’t saved by EzySplit.
            </Text>
            <Text style={styles.consentText}>
              AI can make mistakes - double-check anything important in the app.
            </Text>
            <TouchableOpacity style={styles.consentBtn} onPress={acceptConsent}>
              <Text style={styles.consentBtnText}>Got it, let’s go</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {header}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({animated: true})
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Sparkles size={26} color={theme.color.teal} />
              <Text style={styles.emptyTitle}>Hi {userName}!</Text>
              <Text style={styles.emptyText}>
                Ask about your spending, categories, groups or balances.
              </Text>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestion}
                    disabled={busy}
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
              <Text
                selectable
                style={[
                  styles.bubbleText,
                  item.role === 'user' && styles.userBubbleText,
                ]}>
                {item.text}
              </Text>
            </View>
          )}
          ListFooterComponent={
            busy ? (
              <View style={[styles.bubble, styles.aiBubble, styles.typing]}>
                <ActivityIndicator size="small" color={theme.color.teal} />
                <Text style={styles.typingText}>{status}</Text>
              </View>
            ) : null
          }
        />

        <View
          style={[
            styles.inputBar,
            {paddingBottom: Math.max(insets.bottom, 10)},
          ]}>
          {remaining !== null && (
            <Text style={styles.remaining}>
              {remaining > 0
                ? `${remaining} question${
                    remaining === 1 ? '' : 's'
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
              editable={!busy}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!input.trim() || busy) && styles.sendBtnDisabled,
              ]}
              disabled={!input.trim() || busy}
              onPress={() => send(input)}
              accessibilityLabel="Send">
              <SendHorizontal size={18} color={theme.color.onAccent} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: theme.color.ground},
  loader: {marginTop: 60},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {padding: 4},
  headerMid: {alignItems: 'center'},
  headerTitle: {
    fontFamily: DisplayFont.bold,
    color: theme.color.ink,
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  headerSub: {
    fontFamily: BodyFont.regular,
    color: theme.color.inkFaint,
    fontSize: moderateScale(11.5),
    marginTop: 2,
  },
  headerSpacer: {width: 30},
  consentWrap: {padding: 20},
  consentCard: {padding: 20, gap: 12},
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
  empty: {alignItems: 'center', paddingTop: 24, gap: 8},
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
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
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
    backgroundColor: theme.color.surface,
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
  userBubbleText: {color: theme.color.ink},
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
    backgroundColor: theme.color.groundAlt,
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

export default AssistantScreen;
