import { Modal } from './ui';
import { useL } from '../i18n';

export function KeyboardShortcuts({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const l = useL();
  return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={l('Keyboard shortcuts', 'Raccourcis clavier')}
      >
        <dl className="shortcuts">
          <dt>
            <kbd>Alt</kbd> + <kbd>1</kbd>…<kbd>0</kbd>
          </dt>
          <dd>{l('Switch between views', 'Changer de vue')}</dd>
          <dt>
            <kbd>Alt</kbd> + <kbd>↓</kbd> / <kbd>↑</kbd>
          </dt>
          <dd>
            {l('Next or previous group of questions', 'Groupe de questions suivant ou précédent')}
          </dd>
          <dt>
            <kbd>Ctrl</kbd> + <kbd>S</kbd>
          </dt>
          <dd>
            {l(
              'Save now (changes also save automatically)',
              'Enregistrer maintenant (aussi automatique)',
            )}
          </dd>
          <dt>
            <kbd>←</kbd> <kbd>→</kbd>
          </dt>
          <dd>
            {l(
              'Resize panels when a divider has focus; move between tabs',
              'Redimensionner les panneaux (séparateur actif) ; changer d’onglet',
            )}
          </dd>
          <dt>
            <kbd>?</kbd>
          </dt>
          <dd>{l('Show this list', 'Afficher cette liste')}</dd>
        </dl>
      </Modal>
  );
}
