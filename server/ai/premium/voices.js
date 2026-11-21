// The natural voices customers can pick (Kokoro-82M, Apache-2.0, run on the render server). Each has a short sample in
// web/public/voices/<id>.mp3 so people can hear it before choosing. Only the better-rated English voices are offered.
export const VOICE_LIBRARY = [
  { id: 'af_heart', name: 'Heart', gender: 'female', accent: 'American', tone: 'Warm and friendly' },
  { id: 'af_bella', name: 'Bella', gender: 'female', accent: 'American', tone: 'Bright and lively' },
  { id: 'af_nicole', name: 'Nicole', gender: 'female', accent: 'American', tone: 'Soft and calm' },
  { id: 'af_aoede', name: 'Aoede', gender: 'female', accent: 'American', tone: 'Smooth' },
  { id: 'af_kore', name: 'Kore', gender: 'female', accent: 'American', tone: 'Confident' },
  { id: 'af_sarah', name: 'Sarah', gender: 'female', accent: 'American', tone: 'Clear and natural' },
  { id: 'af_nova', name: 'Nova', gender: 'female', accent: 'American', tone: 'Upbeat' },
  { id: 'bf_emma', name: 'Emma', gender: 'female', accent: 'British', tone: 'Polished' },
  { id: 'bf_isabella', name: 'Isabella', gender: 'female', accent: 'British', tone: 'Gentle' },
  { id: 'am_michael', name: 'Michael', gender: 'male', accent: 'American', tone: 'Warm and steady' },
  { id: 'am_fenrir', name: 'Fenrir', gender: 'male', accent: 'American', tone: 'Bold' },
  { id: 'am_puck', name: 'Puck', gender: 'male', accent: 'American', tone: 'Playful' },
  { id: 'am_onyx', name: 'Onyx', gender: 'male', accent: 'American', tone: 'Deep' },
  { id: 'bm_george', name: 'George', gender: 'male', accent: 'British', tone: 'Classic narrator' },
  { id: 'bm_fable', name: 'Fable', gender: 'male', accent: 'British', tone: 'Storyteller' },
];
export const isVoiceId = (id) => VOICE_LIBRARY.some((v) => v.id === id);
export const defaultVoice = (gender) => (gender === 'male' ? 'am_michael' : 'af_heart');
