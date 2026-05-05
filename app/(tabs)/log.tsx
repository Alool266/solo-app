import { PrimaryButton } from '../../components/PrimaryButton';
import { RestTimerModal } from '../../components/RestTimerModal';
import {
  EQUIPMENT_TAG_IDS,
  type EquipmentTagId,
} from '../../constants/equipmentTags';
import { colors } from '../../constants/theme';
import type { ExerciseEntry, MyExercise, SetEntry, WorkoutPlan } from '../../context/GameContext';
import { useLanguage } from '../../context/LanguageContext';
import { useGame } from '../../context/GameContext';
import {
  deleteStoredExerciseImage,
  pickExerciseImage,
  pickExerciseImageWebFromGesture,
  type ExercisePhotoSource,
} from '../../utils/exercisePhoto';
import { genId } from '../../utils/id';
import {
  bestSetThisMonthOnPlan,
  exercisePrKey,
  formatSessionDuration,
} from '../../utils/workoutPr';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function emptySet(): SetEntry {
  return { id: genId(), weight: 0, reps: 0 };
}

function emptyExercise(): ExerciseEntry {
  return { id: genId(), name: '', sets: [emptySet()] };
}

function exerciseFromMyExercise(m: MyExercise): ExerciseEntry {
  return {
    id: genId(),
    name: m.name,
    ...(m.imageUri ? { imageUri: m.imageUri } : {}),
    sets: [emptySet()],
  };
}

function exerciseHasLabel(ex: ExerciseEntry): boolean {
  return ex.name.trim().length > 0 || Boolean(ex.imageUri?.trim());
}

function PlanLogger({ plan }: { plan: WorkoutPlan }) {
  const planId = plan.id;
  const planTitle = plan.title;
  const { t } = useTranslation();
  const { language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    workouts,
    logWorkout,
    getLastWorkoutForPlan,
    myExercises,
    addMyExercise,
    removeMyExercise,
    updateWorkoutPlanEquipmentTags,
  } = useGame();
  const [title, setTitle] = useState(planTitle);
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<ExerciseEntry[]>([emptyExercise()]);
  const [timerOpen, setTimerOpen] = useState(false);
  const [showRpe, setShowRpe] = useState(false);
  const [saveBanner, setSaveBanner] = useState<{ kind: 'error' | 'ok'; text: string } | null>(
    null
  );

  const sessionStartedAt = useRef(Date.now());
  const [sessionTick, setSessionTick] = useState(0);

  const localeTag = language === 'ar' ? 'ar' : 'en-US';

  useEffect(() => {
    setTitle(planTitle);
  }, [planTitle]);

  useEffect(() => {
    const id = setInterval(() => setSessionTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const sessionElapsedSec = useMemo(() => {
    void sessionTick;
    return Math.max(0, Math.floor((Date.now() - sessionStartedAt.current) / 1000));
  }, [sessionTick]);

  const resetSessionClock = () => {
    sessionStartedAt.current = Date.now();
    setSessionTick((x) => x + 1);
  };

  const togglePlanTag = (tag: EquipmentTagId) => {
    const cur = [...(plan.equipmentTags ?? [])];
    const i = cur.indexOf(tag);
    if (i >= 0) cur.splice(i, 1);
    else cur.push(tag);
    updateWorkoutPlanEquipmentTags(planId, cur as EquipmentTagId[]);
  };

  const planWorkouts = useMemo(
    () => workouts.filter((w) => w.planId === planId),
    [workouts, planId]
  );

  const addExercise = () => {
    setExercises((prev) => [...prev, emptyExercise()]);
  };

  const addExerciseFromSaved = (m: MyExercise) => {
    Keyboard.dismiss();
    setExercises((prev) => [...prev, exerciseFromMyExercise(m)]);
  };

  const confirmRemoveSavedExercise = (id: string) => {
    const body = t('log.removeMyExerciseBody');
    const title = t('log.removeMyExerciseTitle');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${body}`)) removeMyExercise(id);
      return;
    }
    Alert.alert(title, body, [
      { text: t('log.cancel'), style: 'cancel' },
      {
        text: t('log.removeSaved'),
        style: 'destructive',
        onPress: () => removeMyExercise(id),
      },
    ]);
  };

  const saveExerciseToMyList = (ex: ExerciseEntry) => {
    if (!exerciseHasLabel(ex)) return;
    addMyExercise({ name: ex.name, imageUri: ex.imageUri });
    Alert.alert('', t('log.myExerciseSaved'));
  };

  const removeExercise = (id: string) => {
    setExercises((prev) => {
      const dropped = prev.find((e) => e.id === id);
      if (dropped?.imageUri) void deleteStoredExerciseImage(dropped.imageUri);
      if (prev.length <= 1) {
        return [emptyExercise()];
      }
      return prev.filter((e) => e.id !== id);
    });
  };

  const updateExerciseName = (id: string, name: string) => {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, name } : e)));
  };

  const attachExercisePhoto = async (exerciseId: string, source: ExercisePhotoSource) => {
    const uri = await pickExerciseImage(source);
    if (!uri) {
      Alert.alert(t('log.photoDeniedTitle'), t('log.photoDeniedBody'));
      return;
    }
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exerciseId) return e;
        if (e.imageUri && e.imageUri !== uri) void deleteStoredExerciseImage(e.imageUri);
        return { ...e, imageUri: uri };
      })
    );
  };

  const clearExercisePhoto = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exerciseId) return e;
        void deleteStoredExerciseImage(e.imageUri);
        return { ...e, imageUri: undefined };
      })
    );
  };

  const showExercisePhotoOptions = (exerciseId: string) => {
    Alert.alert(t('log.photoTitle'), t('log.photoMessage'), [
      { text: t('log.cancel'), style: 'cancel' },
      {
        text: t('log.fromGallery'),
        onPress: () => void attachExercisePhoto(exerciseId, 'library'),
      },
      {
        text: t('log.fromCamera'),
        onPress: () => void attachExercisePhoto(exerciseId, 'camera'),
      },
    ]);
  };

  const applyPickedExerciseUri = (exerciseId: string, uri: string | null) => {
    if (!uri) return;
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exerciseId) return e;
        if (e.imageUri && e.imageUri !== uri) void deleteStoredExerciseImage(e.imageUri);
        return { ...e, imageUri: uri };
      })
    );
  };

  const addSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === exerciseId ? { ...e, sets: [...e.sets, emptySet()] } : e))
    );
  };

  const removeSet = (exerciseId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exerciseId) return e;
        if (e.sets.length <= 1) return e;
        return { ...e, sets: e.sets.filter((s) => s.id !== setId) };
      })
    );
  };

  const updateSet = (
    exerciseId: string,
    setId: string,
    patch: Partial<Pick<SetEntry, 'weight' | 'reps' | 'rpe'>>
  ) => {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exerciseId) return e;
        return {
          ...e,
          sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
        };
      })
    );
  };

  const repeatLast = () => {
    Keyboard.dismiss();
    const tpl = getLastWorkoutForPlan(planId);
    if (!tpl) {
      Alert.alert(t('log.repeatNoneTitle'), t('log.repeatNonePlanBody'));
      return;
    }
    setTitle(tpl.title);
    setNotes(tpl.notes);
    setExercises(tpl.exercises.length ? tpl.exercises : [emptyExercise()]);
    resetSessionClock();
  };

  const validateAndSave = () => {
    Keyboard.dismiss();
    setSaveBanner(null);
    const hasStructured = exercises.some((ex) => {
      const setOk = ex.sets.some((s) => s.reps > 0 || s.weight > 0);
      return exerciseHasLabel(ex) && setOk;
    });
    const notesOk = notes.trim().length > 0;
    if (!hasStructured && !notesOk) {
      const titleMsg = t('log.validationTitle');
      const bodyMsg = t('log.validationBody');
      setSaveBanner({ kind: 'error', text: bodyMsg });
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`${titleMsg}\n\n${bodyMsg}`);
      } else {
        Alert.alert(titleMsg, bodyMsg);
      }
      return;
    }
    const trimmedExercises = hasStructured ? exercises.filter(exerciseHasLabel) : [];
    const durationSec = Math.min(
      86400,
      Math.max(0, Math.floor((Date.now() - sessionStartedAt.current) / 1000))
    );
    try {
      logWorkout({
        title,
        notes,
        exercises: trimmedExercises,
        planId,
        planTitleSnapshot: planTitle,
        durationSec,
      });
      setTitle(planTitle);
      setNotes('');
      setExercises([emptyExercise()]);
      resetSessionClock();
      const okText = t('log.savedOkPlan');
      setSaveBanner({ kind: 'ok', text: okText });
      setTimeout(() => setSaveBanner(null), 4000);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      const fail = t('log.saveFailed');
      setSaveBanner({ kind: 'error', text: fail });
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(fail);
      } else {
        Alert.alert('', fail);
      }
    }
  };

  /** Tab bar + margin lifts ~90–110px; without extra scroll padding the Save button sits under it and taps miss. */
  const listBottomPad = 24 + insets.bottom + 120;

  const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0);

  const header = (
    <View style={styles.pad}>
      <Pressable
        onPress={() => router.replace('/log')}
        accessibilityRole="button"
        accessibilityLabel={t('log.backToPlans')}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        style={styles.backPlans}
      >
        <Text style={styles.backPlansTxt}>{t('log.backToPlans')}</Text>
      </Pressable>
      <Text style={styles.kicker}>{planTitle}</Text>
      <Text style={styles.title}>{t('log.title')}</Text>
      <Text style={styles.sub}>{t('log.planPageIntro')}</Text>

      <Text style={styles.equipTagsLabel}>{t('log.equipTagsLabel')}</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.equipChipScroll}
      >
        {EQUIPMENT_TAG_IDS.map((tag) => {
          const on = (plan.equipmentTags ?? []).includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => togglePlanTag(tag)}
              style={[styles.equipChip, on && styles.equipChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(`log.equip.${tag}`)}
            >
              <Text style={[styles.equipChipTxt, on && styles.equipChipTxtOn]}>
                {t(`log.equip.${tag}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sessionTimerRow}>
        <Text style={styles.sessionTimerLabel}>{t('log.sessionTimer')}</Text>
        <Text style={styles.sessionTimerValue} accessibilityLiveRegion="polite">
          {formatSessionDuration(sessionElapsedSec)}
        </Text>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.toolbarBtn}>
          <PrimaryButton fullWidth label={t('log.repeatLast')} variant="ghost" onPress={repeatLast} />
        </View>
        <View style={styles.toolbarBtn}>
          <PrimaryButton
            fullWidth
            label={t('log.restTimer')}
            variant="ghost"
            onPress={() => setTimerOpen(true)}
          />
        </View>
      </View>

      <Text style={styles.label}>{t('log.sessionTitle')}</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t('log.sessionPlaceholder')}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />

      <Text style={styles.flowHint}>{t('log.flowHint')}</Text>

      <Text style={[styles.section, styles.myExSection]}>{t('log.myExercisesTitle')}</Text>
      <Text style={styles.myExHint}>{t('log.myExercisesHint')}</Text>
      {myExercises.length > 0 ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.myExScroll}
        >
          {myExercises.map((m) => (
            <View key={m.id} style={styles.myExChip}>
              <Pressable
                onPress={() => addExerciseFromSaved(m)}
                style={styles.myExTap}
                accessibilityRole="button"
              >
                {m.imageUri ? (
                  <Image source={{ uri: m.imageUri }} style={styles.myExImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.myExImg, styles.myExImgPh]}>
                    <Text style={styles.myExImgPhTxt}>—</Text>
                  </View>
                )}
                <Text style={styles.myExName} numberOfLines={2}>
                  {m.name.trim() ? m.name.trim() : t('log.myExerciseNoName')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => confirmRemoveSavedExercise(m.id)}
                style={styles.myExDel}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('log.removeSaved')}
              >
                <Text style={styles.myExDelTxt}>×</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.myExEmpty}>{t('log.myExercisesEmpty')}</Text>
      )}

      <View style={styles.rowBetween}>
        <Text style={styles.section}>{t('log.exercises')}</Text>
        <Pressable onPress={() => setShowRpe((v) => !v)} accessibilityRole="button">
          <Text style={styles.toggle}>{showRpe ? t('log.hideRpe') : t('log.showRpe')}</Text>
        </Pressable>
      </View>

      {exercises.map((ex, ei) => (
        <View key={ex.id} style={styles.exCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.exLabel}>{t('log.exerciseNumber', { n: ei + 1 })}</Text>
            <Pressable
              onPress={() => removeExercise(ex.id)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={
                exercises.length > 1 ? t('log.removeExercise') : t('log.clearExercise')
              }
            >
              <Text style={styles.remove}>
                {exercises.length > 1 ? t('log.removeExercise') : t('log.clearExercise')}
              </Text>
            </Pressable>
          </View>
          <View style={styles.exTopRow}>
            <View style={styles.thumbColumn}>
              <Pressable
                onPress={() =>
                  Platform.OS === 'web'
                    ? pickExerciseImageWebFromGesture('library', (uri) =>
                        applyPickedExerciseUri(ex.id, uri)
                      )
                    : showExercisePhotoOptions(ex.id)
                }
                style={styles.thumbPress}
                accessibilityRole="button"
                accessibilityLabel={t('log.addPhotoA11y')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {ex.imageUri ? (
                  <Image source={{ uri: ex.imageUri }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={styles.thumbPlaceholder}>
                    <Text style={styles.thumbPlaceholderText}>{t('log.addPhoto')}</Text>
                  </View>
                )}
              </Pressable>
              {Platform.OS === 'web' ? (
                <View style={styles.webPhotoBtns}>
                  <Pressable
                    onPress={() =>
                      pickExerciseImageWebFromGesture('library', (uri) =>
                        applyPickedExerciseUri(ex.id, uri)
                      )
                    }
                    style={styles.webPhotoBtn}
                  >
                    <Text style={styles.webPhotoBtnLabel}>{t('log.fromGallery')}</Text>
                  </Pressable>
                  <Text style={styles.webPhotoSep}>·</Text>
                  <Pressable
                    onPress={() =>
                      pickExerciseImageWebFromGesture('camera', (uri) =>
                        applyPickedExerciseUri(ex.id, uri)
                      )
                    }
                    style={styles.webPhotoBtn}
                  >
                    <Text style={styles.webPhotoBtnLabel}>{t('log.fromCamera')}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
            <TextInput
              value={ex.name}
              onChangeText={(txt) => updateExerciseName(ex.id, txt)}
              placeholder={t('log.exerciseNamePh')}
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.exNameInput]}
              accessibilityLabel={t('log.exerciseNamePh')}
            />
          </View>
          {(() => {
            const pk = exercisePrKey(ex.name, ex.imageUri);
            if (!pk) return null;
            const best = bestSetThisMonthOnPlan(workouts, planId, pk);
            if (!best) return null;
            return (
              <Text style={styles.prHint}>
                {t('log.prThisMonth', { weight: best.weight, reps: best.reps })}
              </Text>
            );
          })()}
          {ex.imageUri ? (
            <Pressable onPress={() => clearExercisePhoto(ex.id)} hitSlop={8}>
              <Text style={styles.removePhoto}>{t('log.removePhoto')}</Text>
            </Pressable>
          ) : null}

          {ex.sets.map((s, si) => (
            <View key={s.id} style={styles.setRow}>
              <Text style={styles.setIdx}>{si + 1}</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={s.weight === 0 ? '' : String(s.weight)}
                onChangeText={(txt) =>
                  updateSet(ex.id, s.id, {
                    weight: txt === '' ? 0 : clampNum(parseFloat(txt), 0, 9999),
                  })
                }
                placeholder={t('log.kg')}
                placeholderTextColor={colors.muted}
                style={[styles.inputMini, styles.flex1]}
              />
              <TextInput
                keyboardType="number-pad"
                value={s.reps === 0 ? '' : String(s.reps)}
                onChangeText={(txt) =>
                  updateSet(ex.id, s.id, {
                    reps: txt === '' ? 0 : clampNum(parseInt(txt, 10), 0, 999),
                  })
                }
                placeholder={t('log.reps')}
                placeholderTextColor={colors.muted}
                style={[styles.inputMini, styles.flex1]}
              />
              {showRpe ? (
                <TextInput
                  keyboardType="decimal-pad"
                  value={s.rpe === undefined ? '' : String(s.rpe)}
                  onChangeText={(txt) =>
                    updateSet(ex.id, s.id, {
                      rpe:
                        txt === ''
                          ? undefined
                          : clampNum(parseFloat(txt), 1, 10),
                    })
                  }
                  placeholder={t('log.rpe')}
                  placeholderTextColor={colors.muted}
                  style={[styles.inputMini, styles.flex1]}
                />
              ) : null}
              {ex.sets.length > 1 ? (
                <Pressable onPress={() => removeSet(ex.id, s.id)} hitSlop={8}>
                  <Text style={styles.removeSet}>×</Text>
                </Pressable>
              ) : (
                <View style={{ width: 22 }} />
              )}
            </View>
          ))}

          <PrimaryButton
            label={t('log.addSet')}
            variant="ghost"
            onPress={() => addSet(ex.id)}
          />
          {exerciseHasLabel(ex) ? (
            <Pressable onPress={() => saveExerciseToMyList(ex)} style={styles.saveMyExWrap}>
              <Text style={styles.saveMyEx}>{t('log.saveToMyExercises')}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <PrimaryButton label={t('log.addExercise')} variant="ghost" onPress={addExercise} />

      <Text style={styles.meta}>
        {t('log.setCount', { count: totalSets })}
      </Text>

      <Text style={styles.label}>{t('log.notes')}</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={t('log.notesPlaceholder')}
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.multiline]}
        multiline
      />

      {saveBanner ? (
        <Text
          style={saveBanner.kind === 'error' ? styles.saveBannerErr : styles.saveBannerOk}
          accessibilityLiveRegion="polite"
        >
          {saveBanner.text}
        </Text>
      ) : null}

      <View style={styles.saveBtnWrap}>
        <PrimaryButton fullWidth label={t('log.save')} onPress={validateAndSave} />
      </View>

      <Text style={styles.historyHead}>{t('log.planHistoryHead')}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        style={styles.list}
        data={planWorkouts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
        ListEmptyComponent={
          <Text style={[styles.empty, styles.emptyPad]}>{t('log.planHistoryEmpty')}</Text>
        }
        renderItem={({ item }) => {
          const sets = item.exercises.reduce((a, e) => a + e.sets.length, 0);
          const exCount = item.exercises.length;
          return (
            <View style={[styles.card, styles.cardMargin]}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardXp}>
                +{item.xpEarned} {t('common.xp')}
              </Text>
              {exCount > 0 ? (
                <Text style={styles.cardSummary}>
                  {t('log.historySummary', { exercises: exCount, sets })}
                </Text>
              ) : item.notes ? (
                <Text style={styles.cardSummary}>{t('log.quickNote')}</Text>
              ) : null}
              {item.durationSec != null && item.durationSec > 0 ? (
                <Text style={styles.cardSummary}>
                  {t('log.historyDuration', {
                    time: formatSessionDuration(item.durationSec),
                  })}
                </Text>
              ) : null}
              {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
              {item.exercises.some((e) => e.imageUri) ? (
                <View style={styles.historyThumbs}>
                  {item.exercises
                    .filter((e) => e.imageUri)
                    .map((e) => (
                      <Image
                        key={e.id}
                        source={{ uri: e.imageUri as string }}
                        style={styles.historyThumb}
                        resizeMode="cover"
                      />
                    ))}
                </View>
              ) : null}
              <Text style={styles.cardDate}>
                {new Date(item.at).toLocaleString(localeTag, { numberingSystem: 'latn' })}
              </Text>
            </View>
          );
        }}
      />
      <RestTimerModal visible={timerOpen} onClose={() => setTimerOpen(false)} />
    </SafeAreaView>
  );
}

function clampNum(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  listContent: { flexGrow: 1 },
  pad: { padding: 20, paddingBottom: 8 },
  kicker: { color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 6, lineHeight: 28 },
  sub: { color: colors.muted, marginTop: 10, lineHeight: 22, marginBottom: 12, fontSize: 15 },
  toolbar: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  toolbarBtn: { flex: 1, minWidth: 120 },
  label: { color: colors.muted, marginBottom: 8, marginTop: 12, fontSize: 14 },
  section: { color: colors.text, fontWeight: '800', fontSize: 16 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  toggle: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 52,
  },
  inputMini: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 44,
  },
  flex1: { flex: 1, minWidth: 0 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  exCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  exLabel: { color: colors.accent, fontWeight: '800', fontSize: 13 },
  remove: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap',
  },
  setIdx: {
    width: 22,
    color: colors.muted,
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  removeSet: {
    color: colors.danger,
    fontSize: 22,
    fontWeight: '700',
    width: 22,
    textAlign: 'center',
  },
  exTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
  },
  thumbColumn: { alignItems: 'center', flexShrink: 0 },
  thumbPress: { alignSelf: 'flex-start' },
  webPhotoBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
    maxWidth: 96,
    gap: 4,
  },
  webPhotoBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  webPhotoBtnLabel: { color: colors.accent, fontWeight: '700', fontSize: 12 },
  webPhotoSep: { color: colors.muted, fontSize: 12 },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.bg,
  },
  thumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: Platform.OS === 'web' ? 'solid' : 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: colors.bg,
  },
  thumbPlaceholderText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  exNameInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    paddingVertical: 12,
    alignSelf: 'stretch',
  },
  removePhoto: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  historyThumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  historyThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.bg,
  },
  meta: { color: colors.muted, fontSize: 13, marginTop: 4 },
  historyHead: { color: colors.text, fontWeight: '800', marginTop: 24, marginBottom: 12, fontSize: 17 },
  empty: { color: colors.muted, fontSize: 15 },
  emptyPad: { paddingHorizontal: 20, paddingBottom: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardMargin: { marginHorizontal: 20, marginBottom: 10 },
  cardTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  cardXp: { color: colors.accent, marginTop: 6, fontWeight: '700', fontSize: 14 },
  cardSummary: { color: colors.muted, marginTop: 6, fontSize: 14 },
  cardNotes: { color: colors.muted, marginTop: 8, lineHeight: 22, fontSize: 15 },
  cardDate: { color: colors.muted, marginTop: 8, fontSize: 13 },
  flowHint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    marginBottom: 4,
  },
  myExSection: { marginTop: 14 },
  myExHint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  myExScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
    paddingRight: 8,
  },
  myExChip: {
    width: 104,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  myExTap: { padding: 8, alignItems: 'center' },
  myExImg: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.bg,
    marginBottom: 6,
  },
  myExImgPh: { alignItems: 'center', justifyContent: 'center' },
  myExImgPhTxt: { color: colors.muted, fontSize: 18 },
  myExName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    minHeight: 32,
  },
  myExDel: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  myExDelTxt: { color: colors.danger, fontSize: 16, fontWeight: '800', marginTop: -2 },
  myExEmpty: { color: colors.muted, fontSize: 14, fontStyle: 'italic', marginBottom: 8 },
  saveMyExWrap: { alignSelf: 'flex-start', marginTop: 2 },
  saveMyEx: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  saveBtnWrap: { marginBottom: 8, zIndex: 2 },
  saveBannerErr: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    lineHeight: 20,
  },
  saveBannerOk: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    lineHeight: 20,
  },
  backPlans: { alignSelf: 'flex-start', marginBottom: 10 },
  backPlansTxt: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  hubCreateBtn: { marginTop: 12 },
  hubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  hubRowMain: { flex: 1, minWidth: 0 },
  hubDeleteBtn: { justifyContent: 'center', zIndex: 2 },
  equipTagsLabel: {
    color: colors.muted,
    marginBottom: 8,
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
  },
  equipChipScroll: { flexDirection: 'row', gap: 8, paddingVertical: 4, flexWrap: 'nowrap' },
  equipChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  equipChipOn: { borderColor: colors.accent, backgroundColor: colors.surface },
  equipChipTxt: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  equipChipTxtOn: { color: colors.accent },
  sessionTimerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionTimerLabel: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  sessionTimerValue: { color: colors.accent, fontWeight: '900', fontSize: 18 },
  prHint: {
    color: colors.rankGlow,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  hubTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  hubTagPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hubTagPillTxt: { color: colors.muted, fontSize: 11, fontWeight: '700' },
});

function WorkoutPlansHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { workoutPlans, addWorkoutPlan, removeWorkoutPlan } = useGame();
  const [newTitle, setNewTitle] = useState('');
  const [newPlanTags, setNewPlanTags] = useState<EquipmentTagId[]>([]);

  const toggleNewPlanTag = (tag: EquipmentTagId) => {
    setNewPlanTags((prev) => {
      const i = prev.indexOf(tag);
      if (i >= 0) return prev.filter((_, j) => j !== i);
      return [...prev, tag];
    });
  };

  const sorted = useMemo(
    () => [...workoutPlans].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [workoutPlans]
  );

  const createPlan = () => {
    Keyboard.dismiss();
    const id = addWorkoutPlan(newTitle, newPlanTags);
    if (!id) return;
    setNewTitle('');
    setNewPlanTags([]);
    router.push({ pathname: '/log', params: { planId: id } });
  };

  const confirmDelete = (id: string, title: string) => {
    const dlgTitle = t('log.deletePlanTitle');
    const body = t('log.deletePlanBody', { name: title });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${dlgTitle}\n\n${body}`)) removeWorkoutPlan(id);
      return;
    }
    Alert.alert(dlgTitle, body, [
      { text: t('log.cancel'), style: 'cancel' },
      {
        text: t('log.deletePlan'),
        style: 'destructive',
        onPress: () => removeWorkoutPlan(id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.pad}>
            <Text style={styles.kicker}>{t('log.kicker')}</Text>
            <Text style={styles.title}>{t('log.hubTitle')}</Text>
            <Text style={styles.sub}>{t('log.hubIntro')}</Text>
            <Text style={styles.label}>{t('log.createPlanLabel')}</Text>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder={t('log.createPlanPlaceholder')}
              placeholderTextColor={colors.muted}
              style={styles.input}
              accessibilityLabel={t('log.createPlanPlaceholder')}
            />
            <Text style={styles.equipTagsLabel}>{t('log.equipTagsHint')}</Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.equipChipScroll}
            >
              {EQUIPMENT_TAG_IDS.map((tag) => {
                const on = newPlanTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleNewPlanTag(tag)}
                    style={[styles.equipChip, on && styles.equipChipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={t(`log.equip.${tag}`)}
                  >
                    <Text style={[styles.equipChipTxt, on && styles.equipChipTxtOn]}>
                      {t(`log.equip.${tag}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.hubCreateBtn}>
              <PrimaryButton fullWidth label={t('log.createPlanCta')} onPress={createPlan} />
            </View>
            <Text style={[styles.section, { marginTop: 20 }]}>{t('log.yourPlans')}</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, styles.emptyPad]}>{t('log.hubEmpty')}</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, styles.cardMargin, styles.hubRow]}>
            <Pressable
              style={styles.hubRowMain}
              onPress={() => router.push({ pathname: '/log', params: { planId: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDate}>
                {new Date(item.createdAt).toLocaleDateString(undefined, { numberingSystem: 'latn' })}
              </Text>
              {(item.equipmentTags?.length ?? 0) > 0 ? (
                <View style={styles.hubTagRow}>
                  {item.equipmentTags!.map((tag) => (
                    <View key={tag} style={styles.hubTagPill}>
                      <Text style={styles.hubTagPillTxt}>{t(`log.equip.${tag}`)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => confirmDelete(item.id, item.title)}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              accessibilityRole="button"
              accessibilityLabel={t('log.deletePlan')}
              style={styles.hubDeleteBtn}
            >
              <Text style={styles.remove}>{t('log.deletePlan')}</Text>
            </Pressable>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom + 100 }}
      />
    </SafeAreaView>
  );
}

export default function LogTabScreen() {
  const params = useLocalSearchParams<{ planId?: string | string[] }>();
  const rawId = params.planId;
  const planId = typeof rawId === 'string' ? rawId : rawId?.[0];
  const router = useRouter();
  const { workoutPlans } = useGame();
  const plan = useMemo(
    () => (planId ? workoutPlans.find((p) => p.id === planId) : undefined),
    [workoutPlans, planId]
  );

  useEffect(() => {
    if (planId && !plan) router.replace('/log');
  }, [planId, plan, router]);

  if (!planId) return <WorkoutPlansHub />;
  if (!plan) return null;
  return <PlanLogger plan={plan} />;
}
