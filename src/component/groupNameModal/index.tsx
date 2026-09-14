// src/component/groupNameModal/index.tsx
// Restyled to the glass theme + wrapped in KeyboardAvoidingView so the
// keyboard never covers the single text field on smaller phones.
//
// Currency picker: previously an 8-chip row of hand-picked currencies.
// Replaced with a real, searchable country dropdown (247 countries, backed
// by src/data/countries.ts) so users outside that original shortlist don't
// hit a wall creating a group in their own currency. India stays the
// default, matching the app's INR-first design.

import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Toast from '../../services/toast';
import GlassCard from '../glass/GlassCard';
import {isUpiCurrency} from '../../services/ledger/currency';
import {COUNTRIES, CountryOption} from '../../data/countries';
import theme from '../../utils/theme';

interface GroupNameModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (groupName: string, currency: string) => void;
  loading?: boolean;
}

const DEFAULT_COUNTRY: CountryOption =
  COUNTRIES.find(c => c.code === 'IN') || COUNTRIES[0];

const GroupNameModal: React.FC<GroupNameModalProps> = ({
  visible,
  onClose,
  onCreate,
  loading = false,
}) => {
  const [groupName, setGroupName] = useState('');
  const [country, setCountry] = useState<CountryOption>(DEFAULT_COUNTRY);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return COUNTRIES;
    }
    return COUNTRIES.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [search]);

  const handleCreate = () => {
    // Guard against a second tap landing while the first Create is still
    // in flight (Firestore write) - previously nothing here disabled the
    // button or showed feedback inside the modal itself, so a user could
    // fire off a duplicate createGroup() before the modal had a chance to
    // close.
    if (loading) {
      return;
    }
    const trimmed = groupName.trim();
    if (trimmed.length < 3) {
      Toast.show({
        type: 'error',
        text1: 'Group name too short',
        text2: 'Please enter at least 3 characters.',
      });
      return;
    }
    onCreate(trimmed, country.currency);
    setGroupName('');
    setCountry(DEFAULT_COUNTRY);
  };

  const openPicker = () => {
    if (loading) {
      return;
    }
    setSearch('');
    setPickerVisible(true);
  };

  const selectCountry = (c: CountryOption) => {
    setCountry(c);
    setPickerVisible(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={loading ? undefined : onClose}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
        <TouchableWithoutFeedback onPress={loading ? undefined : onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <GlassCard opaque style={styles.modalContent}>
          <Text style={styles.title}>Name your group</Text>
          <TextInput
            placeholder="e.g. Trip to Goa"
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholderTextColor={theme.color.inkFaint}
            autoFocus
            editable={!loading}
          />
          <Text style={styles.sectionLabel}>Country / Currency</Text>
          <TouchableOpacity
            style={styles.countrySelector}
            disabled={loading}
            onPress={openPicker}>
            <Text style={styles.countrySelectorFlag}>{country.flag}</Text>
            <View style={styles.countrySelectorTextWrap}>
              <Text style={styles.countrySelectorName} numberOfLines={1}>
                {country.name}
              </Text>
              <Text style={styles.countrySelectorSub}>
                {country.currency} · {country.symbol}
              </Text>
            </View>
            <Text style={styles.countrySelectorChevron}>▾</Text>
          </TouchableOpacity>
          <Text style={styles.currencyHint}>
            {isUpiCurrency(country.currency)
              ? 'Settle up opens GPay/PhonePe/Paytm directly with the amount filled in.'
              : 'UPI isn\'t available outside India, so settle up will be a manual "mark as paid" instead.'}
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              style={[styles.cancelButton, loading && styles.buttonDisabled]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={loading}
              style={[styles.createButton, loading && styles.buttonDisabled]}>
              {loading ? (
                <ActivityIndicator color={theme.color.onAccent} size="small" />
              ) : (
                <Text style={styles.createText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </GlassCard>
      </KeyboardAvoidingView>

      <Modal
        visible={pickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <TouchableWithoutFeedback onPress={() => setPickerVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <GlassCard opaque style={styles.pickerCard}>
            <Text style={styles.title}>Choose country</Text>
            <TextInput
              placeholder="Search country or currency"
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={theme.color.inkFaint}
              autoFocus
              autoCorrect={false}
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={item => item.code}
              keyboardShouldPersistTaps="handled"
              style={styles.pickerList}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>No matching country.</Text>
              }
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => selectCountry(item)}>
                  <Text style={styles.pickerRowFlag}>{item.flag}</Text>
                  <Text style={styles.pickerRowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.pickerRowCurrency}>
                    {item.currency}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </GlassCard>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(6,5,12,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {width: '85%'},
  title: {
    fontSize: 18,
    marginBottom: 14,
    fontWeight: '700',
    textAlign: 'center',
    color: theme.color.ink,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 18,
    color: theme.color.ink,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.color.inkFaint,
    marginBottom: 8,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: 12,
  },
  countrySelectorFlag: {
    fontSize: 22,
    marginRight: 10,
  },
  countrySelectorTextWrap: {
    flex: 1,
  },
  countrySelectorName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.ink,
  },
  countrySelectorSub: {
    fontSize: 12,
    color: theme.color.inkFaint,
    marginTop: 1,
  },
  countrySelectorChevron: {
    fontSize: 14,
    color: theme.color.inkFaint,
    marginLeft: 8,
  },
  currencyHint: {
    fontSize: 12,
    color: theme.color.inkFaint,
    marginTop: 8,
    marginBottom: 18,
  },
  buttonContainer: {flexDirection: 'row', gap: 10},
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 12,
    borderRadius: theme.radius.md,
  },
  createButton: {
    flex: 1,
    backgroundColor: theme.color.blue,
    padding: 12,
    borderRadius: theme.radius.md,
  },
  cancelText: {
    color: theme.color.inkSoft,
    textAlign: 'center',
    fontWeight: '600',
  },
  createText: {
    color: theme.color.onAccent,
    textAlign: 'center',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6,5,12,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    width: '88%',
    maxHeight: '75%',
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 10,
    color: theme.color.ink,
  },
  pickerList: {
    flexGrow: 0,
  },
  pickerEmpty: {
    color: theme.color.inkFaint,
    textAlign: 'center',
    paddingVertical: 20,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  pickerRowFlag: {
    fontSize: 20,
    marginRight: 10,
  },
  pickerRowName: {
    flex: 1,
    fontSize: 14,
    color: theme.color.ink,
  },
  pickerRowCurrency: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.inkFaint,
    marginLeft: 8,
  },
});

export default GroupNameModal;
