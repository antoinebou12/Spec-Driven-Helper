import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  Cpu,
  Eye,
  EyeOff,
  GitBranch,
  Globe2,
  Layers,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { api } from '../api';
import { Button } from '../components/ui';
import { ProductStory } from '../components/ProductStory';
import { useL } from '../i18n';
import type { Role } from '../../../../packages/shared/src/schema';
import type { Language } from '../../../../packages/shared/src/templates';

export type AuthOptions = { oidc: boolean; google: boolean; registration: boolean };
type User = { id: string; email: string; name: string; role: Role };
type Mode = 'signin' | 'signup';

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"
      />
      <path
        fill="#FBBC05"
        d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.5 2.2-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

/** Messages for `/?auth=<outcome>` after a single sign-on attempt (see apps/api/src/sso-accounts.ts). */
function useOutcomeMessage(outcome: string | null) {
  const l = useL();
  if (!outcome) return null;
  const messages: Record<string, [string, string, 'status' | 'alert']> = {
    pending: [
      'Account requested. An administrator must activate it before you sign in.',
      'Compte demandé. Un administrateur doit l’activer avant la connexion.',
      'status',
    ],
    'invite-required': [
      'This workspace is by invitation. Ask an administrator to invite your email address.',
      'Cet espace est sur invitation. Demandez à un administrateur d’inviter votre adresse.',
      'alert',
    ],
    'account-exists': [
      'An account already uses this email. Sign in the way you did before; accounts are never linked automatically.',
      'Un compte utilise déjà cette adresse. Connectez-vous comme auparavant ; les comptes ne sont jamais liés automatiquement.',
      'alert',
    ],
    inactive: [
      'Your account is waiting for activation or was disabled. Ask an administrator.',
      'Votre compte attend son activation ou a été désactivé. Demandez à un administrateur.',
      'alert',
    ],
    unverified: [
      'Your identity provider did not confirm your email address.',
      'Votre fournisseur d’identité n’a pas confirmé votre adresse courriel.',
      'alert',
    ],
    expired: [
      'The sign-in took too long or was interrupted. Try again.',
      'La connexion a pris trop de temps ou a été interrompue. Réessayez.',
      'alert',
    ],
    failed: [
      'Single sign-on failed. Try again or use your email and password.',
      'L’authentification unique a échoué. Réessayez ou utilisez votre courriel et mot de passe.',
      'alert',
    ],
  };
  const [en, fr, role] = messages[outcome] ?? messages.failed;
  return { text: l(en, fr), role };
}

export function LoginPanel({
  options,
  invite,
  outcome,
  lang,
  setLang,
  onLogin,
  request = api,
}: {
  options: AuthOptions;
  invite?: string | null;
  outcome?: string | null;
  lang: Language;
  setLang: (l: Language) => void;
  onLogin: (u: User) => void;
  request?: typeof api;
}) {
  const l = useL();
  const id = useId();
  const [mode, setMode] = useState<Mode>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const outcomeMessage = useOutcomeMessage(outcome ?? null);
  const signup = mode === 'signup' && !invite;
  const tabs = options.registration && !invite;
  const sso = options.google || options.oidc;
  const choose = (next: Mode) => {
    setMode(next);
    setError('');
    setNotice('');
  };
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = mode === 'signin' ? 'signup' : 'signin';
    choose(next);
    document.getElementById(`${id}-${next}`)?.focus();
  };
  const ssoLabel = (provider: string) =>
    invite
      ? l(`Accept with ${provider}`, `Accepter avec ${provider}`)
      : signup
        ? l(`Sign up with ${provider}`, `S’inscrire avec ${provider}`)
        : l(`Continue with ${provider}`, `Continuer avec ${provider}`);
  const company = l('company SSO', 'l’authentification d’entreprise');
  return (
    <div className="login-page">
      <section className="login-intro auth-hero">
        <div className="brand">
          <span className="brand-symbol" aria-hidden>
            <Layers size={20} />
          </span>
          <strong>SDD Studio</strong>
        </div>
        <p className="eyebrow">
          {l(
            'Spec-driven development, self-hosted',
            'Développement piloté par les spécifications, autohébergé',
          )}
        </p>
        <h1>
          {l(
            'Great software starts with a clear plan.',
            'Un bon logiciel commence par un plan clair.',
          )}
        </h1>
        <p>
          {l(
            'Requirements, architecture and decisions in one reviewed, traceable specification — ready for your team and its coding agents.',
            'Exigences, architecture et décisions dans une spécification révisée et traçable — prête pour votre équipe et ses agents de code.',
          )}
        </p>
        <ul className="login-features">
          <li>
            <ListChecks size={16} aria-hidden />{' '}
            {l(
              'Guided, adaptive interview across 14 modules',
              'Entretien guidé et adaptatif sur 14 modules',
            )}
          </li>
          <li>
            <GitBranch size={16} aria-hidden />{' '}
            {l(
              'Traceable decisions, tests and baselines',
              'Décisions, tests et références traçables',
            )}
          </li>
          <li>
            <ShieldCheck size={16} aria-hidden />{' '}
            {l('AI proposes, people approve', 'L’IA propose, les personnes approuvent')}
          </li>
        </ul>
        <div
          className="auth-flow"
          aria-label={l('Spec-driven workflow', 'Parcours piloté par les spécifications')}
        >
          {[
            ['constitution', l('Principles', 'Principes')],
            ['specify', l('Specify', 'Spécifier')],
            ['plan', l('Plan', 'Planifier')],
            ['tasks', l('Tasks', 'Tâches')],
            ['implement', l('Implement', 'Réaliser')],
          ].map(([key, label], i) => (
            <span key={key} className={i < 3 ? 'done' : undefined}>
              {i < 3 ? (
                <Check size={13} aria-hidden />
              ) : (
                <span className="auth-flow-dot" aria-hidden />
              )}{' '}
              {label}
            </span>
          ))}
        </div>
        <ul className="auth-trust" aria-label={l('Highlights', 'Points forts')}>
          <li>
            <ShieldCheck size={14} aria-hidden /> {l('Self-hosted', 'Autohébergé')}
          </li>
          <li>
            <Cpu size={14} aria-hidden /> {l('Local AI with Ollama', 'IA locale avec Ollama')}
          </li>
          <li>
            <Globe2 size={14} aria-hidden /> {l('English & French', 'Français et anglais')}
          </li>
          <li>
            <Sparkles size={14} aria-hidden /> WCAG 2.2 AA
          </li>
        </ul>
      </section>
      <section className="login-card auth-card" aria-labelledby={`${id}-title`}>
        <div className="login-lang">
          <label>
            <span className="sr-only">{l('Interface language', 'Langue de l’interface')}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as Language)}>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </label>
        </div>
        <h2 id={`${id}-title`}>
          {invite
            ? l('Accept your invitation', 'Accepter votre invitation')
            : signup
              ? l('Create your account', 'Créer votre compte')
              : l('Sign in', 'Connexion')}
        </h2>
        <p className="muted auth-subtitle">
          {invite
            ? l(
                'Choose how you will sign in to this workspace.',
                'Choisissez comment vous vous connecterez à cet espace.',
              )
            : signup
              ? l(
                  'Request access. An administrator activates new accounts.',
                  'Demandez un accès. Un administrateur active les nouveaux comptes.',
                )
              : l(
                  'Welcome back. Pick up where your team left off.',
                  'Bon retour. Reprenez là où votre équipe s’est arrêtée.',
                )}
        </p>
        {tabs && (
          <div className="auth-tabs" role="tablist" aria-label={l('Account', 'Compte')}>
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                id={`${id}-${m}`}
                type="button"
                role="tab"
                aria-selected={mode === m}
                aria-controls={`${id}-panel`}
                tabIndex={mode === m ? 0 : -1}
                onClick={() => choose(m)}
                onKeyDown={onTabKey}
              >
                {m === 'signin'
                  ? l('Sign in', 'Connexion')
                  : l('Create account', 'Créer un compte')}
              </button>
            ))}
          </div>
        )}
        {outcomeMessage && !error && !notice && (
          <p
            className={outcomeMessage.role === 'alert' ? 'auth-message error' : 'auth-message'}
            role={outcomeMessage.role}
          >
            {outcomeMessage.text}
          </p>
        )}
        <div
          id={`${id}-panel`}
          role={tabs ? 'tabpanel' : undefined}
          aria-labelledby={tabs ? `${id}-${mode}` : undefined}
          className="form-stack"
        >
          {sso && (
            <>
              <div className="sso-buttons">
                {options.google && (
                  <Button asChild>
                    <a href="/api/v1/auth/google">
                      <GoogleMark /> {ssoLabel('Google')}
                    </a>
                  </Button>
                )}
                {options.oidc && (
                  <Button asChild>
                    <a href="/api/v1/auth/oidc">
                      <Building2 size={16} aria-hidden /> {ssoLabel(company)}
                    </a>
                  </Button>
                )}
              </div>
              <p className="auth-divider">
                <span>{l('or with email', 'ou avec un courriel')}</span>
              </p>
            </>
          )}
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              setNotice('');
              const f = new FormData(e.currentTarget);
              try {
                if (signup) {
                  await request('/auth/signup', 'POST', {
                    name: f.get('name'),
                    email: f.get('email'),
                    password: f.get('password'),
                  });
                  setMode('signin');
                  setNotice(
                    l(
                      'Account requested. An administrator must activate it before you sign in.',
                      'Compte demandé. Un administrateur doit l’activer avant la connexion.',
                    ),
                  );
                  return;
                }
                onLogin(
                  await request<User>(
                    invite ? '/auth/accept-invite' : '/auth/login',
                    'POST',
                    invite
                      ? { token: invite, name: f.get('name'), password: f.get('password') }
                      : { email: f.get('email'), password: f.get('password') },
                  ),
                );
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {(signup || invite) && (
              <label>
                {l('Your name', 'Votre nom')}
                <input name="name" required autoComplete="name" />
              </label>
            )}
            {!invite && (
              <label>
                {l('Email address', 'Adresse courriel')}
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete={signup ? 'email' : 'username'}
                />
              </label>
            )}
            <div className="password-field">
              <label htmlFor={`${id}-password`}>{l('Password', 'Mot de passe')}</label>
              <div>
                <input
                  id={`${id}-password`}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={invite || signup ? 12 : 1}
                  autoComplete={invite || signup ? 'new-password' : 'current-password'}
                  aria-describedby={invite || signup ? `${id}-password-hint` : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-pressed={showPassword}
                  aria-label={
                    showPassword
                      ? l('Hide password', 'Masquer le mot de passe')
                      : l('Show password', 'Afficher le mot de passe')
                  }
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </Button>
              </div>
              {(invite || signup) && (
                <small id={`${id}-password-hint`} className="muted">
                  {l(
                    'At least 12 characters. A short sentence is easy to remember.',
                    'Au moins 12 caractères. Une courte phrase est facile à retenir.',
                  )}
                </small>
              )}
            </div>
            {error && (
              <p className="auth-message error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="auth-message" role="status">
                {notice}
              </p>
            )}
            <Button variant="primary" type="submit" disabled={busy}>
              {busy
                ? l('Please wait…', 'Un instant…')
                : signup
                  ? l('Request account', 'Demander un compte')
                  : invite
                    ? l('Join workspace', 'Rejoindre l’espace')
                    : l('Sign in', 'Se connecter')}{' '}
              <ArrowRight size={15} aria-hidden />
            </Button>
          </form>
        </div>
        {!options.registration && !invite && (
          <p className="muted small auth-note">
            {l(
              'Access is by invitation. Ask your workspace owner for an account.',
              'Accès sur invitation. Demandez un compte au propriétaire de l’espace.',
            )}
          </p>
        )}
      </section>
      <ProductStory />
    </div>
  );
}

/** Sign-in, sign-up and invitation page; loads the sign-in methods the workspace allows. */
export default function Login({
  onLogin,
  lang,
  setLang,
}: {
  onLogin: (u: User) => void;
  lang: Language;
  setLang: (l: Language) => void;
}) {
  const [options, setOptions] = useState<AuthOptions>({
    oidc: false,
    google: false,
    registration: false,
  });
  const params = new URLSearchParams(location.search);
  useEffect(() => {
    api<AuthOptions>('/auth/options')
      .then((r) =>
        setOptions({ oidc: !!r.oidc, google: !!r.google, registration: !!r.registration }),
      )
      .catch(() => {});
  }, []);
  return (
    <LoginPanel
      options={options}
      invite={params.get('invite')}
      outcome={params.get('auth')}
      lang={lang}
      setLang={setLang}
      onLogin={onLogin}
    />
  );
}
