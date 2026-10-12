import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');
export const IS_COMPACT = width < 380;
export const IS_SHORT = height < 780;

export const C = {
  bg:           '#F5F2ED',
  bgDeep:       '#EDE9E2',
  surface:      '#FDFBF8',
  surfaceInset: '#F0EDE7',
  ink:          '#1A1E2E',
  inkMid:       '#3D4360',
  inkLight:     '#7C8099',
  inkFaint:     '#B8BBCA',
  accent:       '#2D3A8C',
  accentLight:  '#EEF0FB',
  accentMid:    '#6B7AC4',
  accentGlow:   'rgba(45,58,140,0.08)',
  border:       '#DDD9D0',
  borderFocus:  '#2D3A8C',
  borderInk:    '#C8C4BA',
  error:        '#C0392B',
  errorBg:      '#FDF3F2',
  success:      '#1A7A4A',
  orb1: 'rgba(45,58,140,0.04)',
  orb2: 'rgba(80,100,200,0.03)',
  orb3: 'rgba(180,160,100,0.05)',
};

export const FONT = {
  display: Platform.OS === 'ios' ? 'Georgia'     : 'serif',
  mono:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
};

export const bgS = StyleSheet.create({ orb: { position: 'absolute', borderRadius: 9999 } });

export const lhS = StyleSheet.create({ wrap: { marginBottom: 28, overflow: 'hidden' }, thick: { height: 2, backgroundColor: C.accent, borderRadius: 1, marginBottom: 3 }, thin: { height: 0.75, backgroundColor: C.border } });

export const wmS = StyleSheet.create({ wrap: { alignItems: 'center', marginBottom: IS_COMPACT ? 16 : 18 }, crest: { width: 48, height: 48, borderRadius: 14, marginBottom: 10, shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowRadius: 16, elevation: 4, backgroundColor: C.surface }, crestInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: C.accentLight, borderWidth: 1.5, borderColor: C.accent + '30' }, name: { fontSize: IS_COMPACT ? 20 : 24, fontWeight: '800', color: C.ink, letterSpacing: IS_COMPACT ? 4 : 5, fontFamily: FONT.display, textAlign: 'center' }, tagline: { fontSize: IS_COMPACT ? 9 : 10, color: C.inkLight, letterSpacing: IS_COMPACT ? 1.5 : 2, textTransform: 'uppercase', marginTop: 4, marginBottom: 14, textAlign: 'center' }, bottomRule: { width: 40, height: 2, backgroundColor: C.accent, borderRadius: 1, opacity: 0.4 } });

export const lpS = StyleSheet.create({
  wrap: { marginBottom: 14 },
  panel: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(45,58,140,0.10)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 6, marginBottom: 8 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(45,58,140,0.08)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  livePillText: { fontSize: 10, fontWeight: '800', color: C.accent, letterSpacing: 0.4, textTransform: 'uppercase' },
  timeLabel: { fontSize: IS_COMPACT ? 13 : 14, fontWeight: '800', color: C.ink, fontFamily: FONT.mono, letterSpacing: 0.2 },
  greeting: { fontSize: 17, fontWeight: '800', color: C.ink, marginBottom: 2, letterSpacing: -0.2 },
  dateLabel: { fontSize: 11, color: C.inkLight, fontWeight: '600', marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(45,58,140,0.08)',
  },
  metaChipText: { fontSize: 11, fontWeight: '700', color: C.inkMid },
});

export const inS = StyleSheet.create({ outer: { marginBottom: 12 }, label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }, wrap: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1.5, shadowColor: C.accent, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, input: { flex: 1, color: C.ink, fontSize: 14, letterSpacing: 0.2 }, errorText: { fontSize: 10, color: C.error, marginTop: 4, marginLeft: 4, fontWeight: '600' } });

export const btnS = StyleSheet.create({ outer: { borderRadius: 14, overflow: 'hidden', shadowColor: C.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 8 }, gradient: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }, label: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2.5, textTransform: 'uppercase', fontFamily: FONT.display }, chip: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' } });

export const trS = StyleSheet.create({ 
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20, paddingHorizontal: 4 }, 
  text: { flex: 1, fontSize: 11, color: C.inkLight, fontWeight: '600', letterSpacing: 0.2, lineHeight: 16, textAlign: 'center' } 
});

export const ldS = StyleSheet.create({ 
  root: { flex: 1, backgroundColor: C.bg }, 
  safe: { flex: 1 }, body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }, crestWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }, ring: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: 'transparent', borderTopColor: C.accent, borderRightColor: C.accentMid }, crestInner: { width: 62, height: 62, borderRadius: 18, backgroundColor: C.accentLight, borderWidth: 1.5, borderColor: C.accent + '35', alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }, heading: { fontSize: 22, fontWeight: '800', color: C.ink, fontFamily: FONT.display, letterSpacing: -0.3 }, 
  sub: { fontSize: 13, color: C.inkLight, letterSpacing: 0.3, marginBottom: 16, textAlign: 'center' }, // Reduced marginBottom to fit the new box
  // NEW: Info Box Styles
  infoBox: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentLight, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, marginBottom: 24, gap: 12, borderWidth: 1, borderColor: C.accent + '25' },
  infoText: { flex: 1, fontSize: 12, color: C.accent, fontWeight: '600', lineHeight: 18 },
  stepsCard: { alignSelf: 'stretch', backgroundColor: C.surface, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border, shadowColor: C.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 }, stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.75, borderBottomColor: C.borderInk }, stepBubble: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.surfaceInset, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }, stepDone: { backgroundColor: C.accent, borderColor: C.accent }, stepActive: { borderColor: C.accent, borderWidth: 2 }, stepDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.inkFaint }, stepDotActive: { backgroundColor: C.accent }, stepLabel: { flex: 1, fontSize: 13, color: C.inkLight, fontWeight: '600' }, activePip: { backgroundColor: C.accentLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }, activePipText: { fontSize: 10, color: C.accent, fontWeight: '700', letterSpacing: 0.3 }, captchaCard: { alignSelf: 'stretch', marginTop: 16, backgroundColor: C.surface, borderRadius: 18, padding: 18, borderWidth: 1.5, borderColor: C.accent + '35', shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 }, captchaHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }, captchaIconWrap: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center' }, captchaTitle: { fontSize: 15, fontWeight: '800', color: C.ink }, captchaHint: { fontSize: 12, color: C.inkLight, lineHeight: 18, marginBottom: 14 }, captchaImg: { height: 50, width: 160, alignSelf: 'center', marginBottom: 14, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: '#FFF' }, captchaRow: { flexDirection: 'row', gap: 10 }, captchaInput: { flex: 1, height: 50, backgroundColor: C.surfaceInset, color: C.ink, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1.5, borderColor: C.border, fontSize: 18, letterSpacing: 4, fontFamily: FONT.mono, textAlign: 'center' }, captchaBtn: { borderRadius: 12, overflow: 'hidden' }, captchaBtnGrad: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' } 
});

export const s = StyleSheet.create({ 
  root: { flex: 1, backgroundColor: C.bg }, 
  safe: { flex: 1 }, 
  kav: { flex: 1 }, 
  scrollContent: { flexGrow: 1, justifyContent: IS_SHORT ? 'flex-start' : 'center', paddingHorizontal: 20, paddingTop: IS_SHORT ? 20 : 28, paddingBottom: 28 },
  card: { width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: C.surface, borderRadius: 24, paddingHorizontal: IS_COMPACT ? 16 : 22, paddingVertical: IS_COMPACT ? 18 : 22, borderWidth: 1, borderColor: C.border, shadowColor: '#8A7E6A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 32, elevation: 10, overflow: 'hidden' }, 
  cardTint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.9 },
  cardOrbTop: { position: 'absolute', width: 160, height: 160, borderRadius: 80, top: -52, right: -42, backgroundColor: 'rgba(45,58,140,0.05)' },
  cardOrbBottom: { position: 'absolute', width: 120, height: 120, borderRadius: 60, bottom: -36, left: -26, backgroundColor: 'rgba(107,122,196,0.06)' },
  sectionLabel: { fontSize: 12, color: C.inkLight, fontWeight: '600', letterSpacing: 0.2, marginBottom: 4, textAlign: 'center' }, 
  sectionSub: { fontSize: 11, color: C.inkMid, fontWeight: '500', lineHeight: 16, marginBottom: 12, textAlign: 'center', paddingHorizontal: 4 },
  fields: { marginBottom: 4 }, 
  footerWrap: { marginTop: 16 },
  footerRule: { height: 1, backgroundColor: C.border, opacity: 0.6 },
  
  // NEW STYLES FOR THE CUSTOM MODAL
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(26, 30, 46, 0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  modalCard: { width: '100%', backgroundColor: C.surface, borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: C.ink, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, borderWidth: 1, borderColor: C.border },
  modalIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.errorBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(192, 57, 43, 0.2)' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: C.ink, fontFamily: FONT.display, marginBottom: 8 },
  modalText: { fontSize: 14, color: C.inkLight, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalBtn: { backgroundColor: C.accentLight, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(45, 58, 140, 0.1)' },
  modalBtnText: { color: C.accent, fontWeight: '700', fontSize: 15, letterSpacing: 0.5 }
});
