import { Volume2, X } from 'lucide-react';
import { speak, isSpeechSupported } from '../lib/speech';
import { resolveDisplayMeanings } from '../lib/segment';

interface WordDetailPanelProps {
  text: string;
  pinyin: string | null;
  meanings: string[] | null;
  onClose: () => void;
}

export function WordDetailPanel({ text, pinyin, meanings, onClose }: WordDetailPanelProps) {
  const speechSupported = isSpeechSupported();

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-panel">
        <div className="detail-header">
          <div className="detail-heading">
            <span className="detail-hanzi">{text}</span>
            <span className="detail-pinyin">{pinyin}</span>
          </div>
          <div className="detail-header-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => speak(text)}
              disabled={!speechSupported}
              aria-label="Read this word aloud"
            >
              <Volume2 size={20} aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
        <ul className="detail-meanings">
          {resolveDisplayMeanings(meanings, pinyin).map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
