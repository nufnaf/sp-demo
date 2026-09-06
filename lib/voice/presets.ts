export const DEFAULT_DOUBAO_ASR_RESOURCE_ID = "volc.bigasr.sauc.duration";
export const DEFAULT_DOUBAO_TTS_RESOURCE_ID = "seed-tts-2.0";
export const DEFAULT_DOUBAO_TTS_SPEAKER = "zh_male_m191_uranus_bigtts";
export const DEFAULT_DOUBAO_TTS_SAMPLE_RATE = 24_000;

export interface DoubaoSpeakerPreset {
  id: string;
  /** Display name as listed by Volcengine. */
  name: string;
  /** Short character note shown next to the name. */
  note: string;
}

/** seed-tts-2.0 voices verified against the bidirectional TTS endpoint on 2026-09-06. */
export const DOUBAO_TTS_SPEAKER_PRESETS: readonly DoubaoSpeakerPreset[] = [
  { id: "zh_male_m191_uranus_bigtts", name: "云舟", note: "沉稳男声，通用助理" },
  { id: "zh_female_xiaohe_uranus_bigtts", name: "小何", note: "清晰女声，通用助理" },
  { id: "zh_female_kefunvsheng_uranus_bigtts", name: "暖阳", note: "亲切女声，客服" },
  { id: "zh_female_shuangkuaisisi_uranus_bigtts", name: "爽快思思", note: "利落女声" },
  { id: "zh_male_liufei_uranus_bigtts", name: "刘飞", note: "自然男声" },
  { id: "zh_female_liuchangnv_uranus_bigtts", name: "流畅女声", note: "播报、有声书" },
  { id: "zh_female_vv_uranus_bigtts", name: "Vivi", note: "活泼女声" },
  { id: "zh_female_cancan_uranus_bigtts", name: "灿灿", note: "明亮女声" },
];
