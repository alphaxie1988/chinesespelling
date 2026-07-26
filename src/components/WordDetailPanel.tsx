import { useEffect, useState } from 'react';
import { Lightbulb, Volume2, X } from 'lucide-react';
import { speak, isSpeechSupported } from '../lib/speech';
import { isChineseChar, resolveDisplayMeanings } from '../lib/segment';
import { getMnemonicsForText, loadDecomposition } from '../lib/mnemonics';
import type { Dictionary, DecompositionData } from '../types';

interface WordDetailPanelProps {
  text: string;
  pinyin: string | null;
  meanings: string[] | null;
  dict: Dictionary;
  onClose: () => void;
}

export function WordDetailPanel({ text, pinyin, meanings, dict, onClose }: WordDetailPanelProps) {
  const speechSupported = isSpeechSupported();
  const [decomp, setDecomp] = useState<DecompositionData | null>(null);

  useEffect(() => {
    loadDecomposition()
      .then(setDecomp)
      .catch(() => setDecomp({}));
  }, []);

  const mnemonics = decomp ? getMnemonicsForText(text, decomp, dict, isChineseChar) : [];

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

        {mnemonics.length > 0 && (
          <div className="mnemonic-box">
            <h3 className="icon-inline">
              <Lightbulb size={16} aria-hidden="true" /> Creative ways to remember
            </h3>
            <ul>
              {mnemonics.map((m) => (
                <li key={m.char}>
                  <strong>{m.char}</strong>: {m.hint ?? 'No breakdown available — make up your own story for this one!'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
