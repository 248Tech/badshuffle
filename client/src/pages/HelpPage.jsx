import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const guideOptions = [
  {
    id: 'managed-local',
    title: 'Managed Local Onyx',
    audience: 'Run Onyx on the BadShuffle machine',
    description: 'Choose this if BadShuffle should install and control the local Onyx companion runtime.',
    steps: [
      {
        title: 'Open Onyx Settings',
        description: 'Set Onyx Mode to managed local or auto, then confirm the API key field is ready for the token you will create later.',
        actionLabel: 'Open Settings',
        actionHref: '/settings',
        internal: true,
        sectionId: 'onyx',
      },
      {
        title: 'Open Runtime Controls',
        description: 'Use Admin > System to detect, install, start, or restart the managed local Onyx runtime.',
        actionLabel: 'Open Admin',
        actionHref: '/admin',
        internal: true,
        sectionId: 'onyx',
      },
      {
        title: 'Finish Onyx First-Run Setup',
        description: 'Open the local Onyx site, create the initial admin account if prompted, and verify the site is healthy in the browser.',
        actionLabel: 'Open Onyx Docs',
        actionHref: 'https://docs.onyx.app/deployment/overview',
        internal: false,
        sectionId: 'onyx',
      },
      {
        title: 'Create And Save Token',
        description: 'Create an API token in Onyx, paste it into BadShuffle Settings > Onyx API Key, and save.',
        actionLabel: 'Open Developer Overview',
        actionHref: 'https://docs.onyx.app/developers/overview',
        internal: false,
        sectionId: 'onyx',
      },
      {
        title: 'Test Team Chat',
        description: 'Run a simple prompt in Team Chat and confirm the reply is stored back in the thread.',
        actionLabel: 'Open Team Chat',
        actionHref: '/team-chat',
        internal: true,
        sectionId: 'app-areas',
      },
    ],
  },
  {
    id: 'hosted',
    title: 'Hosted Or External Onyx',
    audience: 'Use an existing Onyx deployment',
    description: 'Choose this if Onyx already runs elsewhere and BadShuffle should call it over the network.',
    steps: [
      {
        title: 'Open Onyx Settings',
        description: 'Set Onyx Mode to external or auto, then enter the hosted base URL without a trailing slash.',
        actionLabel: 'Open Settings',
        actionHref: '/settings',
        internal: true,
        sectionId: 'onyx',
      },
      {
        title: 'Create An Onyx Token',
        description: 'Create the token in the same hosted Onyx deployment you are pointing BadShuffle at.',
        actionLabel: 'Open Developer Overview',
        actionHref: 'https://docs.onyx.app/developers/overview',
        internal: false,
        sectionId: 'onyx',
      },
      {
        title: 'Verify Chat API Shape',
        description: 'Use the docs or API explorer to confirm your deployment exposes the current chat endpoints BadShuffle relies on.',
        actionLabel: 'Open Chat API Docs',
        actionHref: 'https://docs.onyx.app/developers/api_reference/chat/create_new_chat_session',
        internal: false,
        sectionId: 'onyx',
      },
      {
        title: 'Save Token In BadShuffle',
        description: 'Paste the token into Onyx API Key and save the BadShuffle settings.',
        actionLabel: 'Open Settings',
        actionHref: '/settings',
        internal: true,
        sectionId: 'onyx',
      },
      {
        title: 'Test Team Chat',
        description: 'Send a short prompt and confirm the response is returned and saved.',
        actionLabel: 'Open Team Chat',
        actionHref: '/team-chat',
        internal: true,
        sectionId: 'app-areas',
      },
    ],
  },
  {
    id: 'bootstrap',
    title: 'First-Time App Setup',
    audience: 'Bring a new BadShuffle environment online',
    description: 'Choose this if you are setting up the whole app, not just the Onyx integration.',
    steps: [
      {
        title: 'Open Settings',
        description: 'Fill out company info, timezone, branding, and any required base configuration.',
        actionLabel: 'Open Settings',
        actionHref: '/settings',
        internal: true,
        sectionId: 'app-setup',
      },
      {
        title: 'Review Team Access',
        description: 'Approve users and verify module permissions before broader rollout.',
        actionLabel: 'Open Team',
        actionHref: '/team',
        internal: true,
        sectionId: 'app-areas',
      },
      {
        title: 'Configure Messages',
        description: 'Set up message settings and notification behavior before relying on inbound and outbound communication.',
        actionLabel: 'Open Message Settings',
        actionHref: '/message-settings',
        internal: true,
        sectionId: 'app-areas',
      },
      {
        title: 'Review Inventory Defaults',
        description: 'Check inventory settings before users depend on category filtering, stock behavior, or item workflows.',
        actionLabel: 'Open Inventory Settings',
        actionHref: '/inventory-settings',
        internal: true,
        sectionId: 'app-areas',
      },
      {
        title: 'Finish Onyx If Needed',
        description: 'If your team will use AI-assisted chat, finish one of the Onyx setup paths before rollout.',
        actionLabel: 'Jump To Onyx Section',
        actionHref: '#onyx',
        internal: true,
        sectionId: 'onyx',
      },
    ],
  },
  {
    id: 'recovery',
    title: 'Database Recovery And Reset',
    audience: 'Use when debugging migrations or bad data',
    description: 'Choose this if startup, schema, or stored-data issues are blocking the app.',
    steps: [
      {
        title: 'Read The DB Reference',
        description: 'Confirm where the database lives and how schema plus migrations are applied before editing anything.',
        actionLabel: 'Jump To Database Section',
        actionHref: '#database',
        internal: true,
        sectionId: 'database',
      },
      {
        title: 'Take A Fresh Backup',
        description: 'Back up the database before trying any destructive reset or repair path.',
        actionLabel: 'Jump To Backups',
        actionHref: '#backups',
        internal: true,
        sectionId: 'backups',
      },
      {
        title: 'Use The Reset Flow Carefully',
        description: 'Only wipe the database if you understand the data loss and already have a backup.',
        actionLabel: 'Open Reset Reference',
        actionHref: '#backups',
        internal: true,
        sectionId: 'backups',
      },
      {
        title: 'Retest Startup',
        description: 'After recovery, let the server fully boot so schema and migrations can be reapplied.',
        actionLabel: 'Jump To Troubleshooting',
        actionHref: '#troubleshooting',
        internal: true,
        sectionId: 'troubleshooting',
      },
    ],
  },
];

const quickLaunch = [
  { label: 'Settings', href: '/settings', internal: true },
  { label: 'Admin', href: '/admin', internal: true },
  { label: 'Team Chat', href: '/team-chat', internal: true },
  { label: 'Projects', href: '/quotes', internal: true },
  { label: 'Inventory', href: '/inventory', internal: true },
];

const sections = [
  {
    id: 'onyx',
    eyebrow: 'Section 1',
    title: 'Onyx AI Setup',
    summary: 'Set this up first if you want Team Chat and Quote AI. BadShuffle calls Onyx as a server-side client, so the Onyx runtime, auth mode, and API token all matter.',
    links: [
      { label: 'Onyx Deployment Overview', href: 'https://docs.onyx.app/deployment/overview' },
      { label: 'Onyx Developer Overview', href: 'https://docs.onyx.app/developers/overview' },
      { label: 'Create New Chat Session API', href: 'https://docs.onyx.app/developers/api_reference/chat/create_new_chat_session' },
      { label: 'OpenAPI Explorer', href: 'https://cloud.onyx.app/api/docs' },
    ],
    blocks: [
      {
        title: 'Local Onyx Managed By BadShuffle',
        body: 'Use this when the BadShuffle machine should also run the Onyx containers.',
        steps: [
          'Open BadShuffle Settings and set Onyx Mode to managed local or auto.',
          'Go to Admin > System and use detect, install, start, or restart for the managed local runtime.',
          'Wait for the runtime to report healthy before testing Team Chat.',
          'Open the local Onyx site in the browser and finish first-run account setup if prompted.',
          'Create an API token inside Onyx and paste it into BadShuffle Settings > Onyx API Key.',
          'Save settings, then restart managed local Onyx if you changed runtime auth or deployment configuration.',
          'Open Team Chat and test a simple prompt before rolling the feature out to the team.',
        ],
        notes: [
          'BadShuffle now rewrites managed-local AUTH_TYPE to disabled in the deployment .env, but that file change only takes effect after a restart.',
          'Even for local mode, current Onyx chat APIs still require a bearer token for BadShuffle requests.',
        ],
      },
      {
        title: 'Hosted Or External Onyx',
        body: 'Use this when Onyx already runs on another machine, VM, or managed host.',
        steps: [
          'Set Onyx Mode to external or auto if you want local preferred and hosted as fallback.',
          'Enter the full external base URL in BadShuffle Settings, for example your Onyx domain without a trailing slash.',
          'Create an API token in that Onyx deployment and paste it into Onyx API Key in BadShuffle.',
          'Save settings and confirm the external deployment is reachable from the BadShuffle server network, not just from your browser.',
          'Test Team Chat with a short message and confirm the response is stored back in the thread.',
        ],
        notes: [
          'A browser session in Onyx is not enough. BadShuffle needs a reusable API token it can send in the Authorization header.',
          'If hosted Onyx is behind a proxy or VPN, debug connectivity from the BadShuffle server side first.',
        ],
      },
      {
        title: 'Onyx Token Checklist',
        body: 'If Team Chat returns 403, assume the token path is wrong until proven otherwise.',
        steps: [
          'Make sure the token exists in the same Onyx deployment you are pointing BadShuffle at.',
          'Paste the token exactly as issued and save BadShuffle Settings.',
          'If the deployment changed, replace the old token instead of assuming it still applies.',
          'Retest from Team Chat or Quote AI after saving.',
        ],
      },
    ],
  },
  {
    id: 'app-setup',
    eyebrow: 'Section 2',
    title: 'First Run And App Bootstrap',
    summary: 'On startup, BadShuffle initializes the database, applies base schema, runs migrations, seeds default settings, and prepares the first-user bootstrap flow.',
    links: [
      { label: 'Settings', href: '/settings', internal: true },
      { label: 'Admin', href: '/admin', internal: true },
      { label: 'Help', href: '/help', internal: true },
    ],
    blocks: [
      {
        title: 'Initial Server Startup',
        steps: [
          'Start the BadShuffle server and watch for the database initialization log line.',
          'Let the server finish startup once so schema and migration work completes.',
          'Open the web app and complete setup if the app routes you there.',
          'Create the first user account. The app bootstrap promotes the first user when needed.',
        ],
      },
      {
        title: 'Core Admin Checklist',
        steps: [
          'Fill in company name, email, address, timezone, and branding in Settings.',
          'Review module permissions, team members, and approval state before broad access is granted.',
          'Configure mail settings before relying on inbox, quote-thread replies, or notifications.',
          'Finish Onyx setup before training users on Team Chat or Quote AI.',
        ],
      },
    ],
  },
  {
    id: 'database',
    eyebrow: 'Section 3',
    title: 'Database, Storage, And Schema',
    summary: 'BadShuffle stores its application data in SQLite via a sql.js wrapper. In normal operation, you should manage data through the UI and app code, not by hand-editing the database.',
    blocks: [
      {
        title: 'What The App Uses',
        facts: [
          'Primary DB file: badshuffle.db',
          'Default dev location: server/badshuffle.db',
          'Override supported: DB_PATH environment variable',
          'Persistence model: file exported after writes',
          'Schema entry point: server/db/schema.js',
          'Migration entry point: server/db/migrations.js',
        ],
      },
      {
        title: 'Schema Behavior',
        steps: [
          'Base schema modules cover items, users, quotes, settings, and leads.',
          'Migration passes create or evolve newer tables for files, messages, orgs, and other feature areas.',
          'You do not need to manually create tables before starting the app.',
          'If you update BadShuffle, let the server start fully once so migrations can finish.',
        ],
      },
      {
        title: 'When To Be Careful',
        steps: [
          'Do not manually edit schema unless you also understand the matching migration and application logic.',
          'Do not run multiple independent live processes against the same DB file unless that deployment is intentional.',
          'If a migration fails, back up the DB before retrying or changing anything.',
        ],
      },
    ],
  },
  {
    id: 'backups',
    eyebrow: 'Section 4',
    title: 'Backups, Reset, And Recovery',
    summary: 'Back up before destructive operations. The fastest reliable backup is still a direct copy of the database while the app is stopped.',
    blocks: [
      {
        title: 'Recommended Backup Flow',
        steps: [
          'Stop the server if possible.',
          'Copy badshuffle.db to a dated backup location.',
          'Back up uploads and any separate runtime directories you care about, not just the database file.',
          'Before major upgrades or migration debugging, take a fresh backup even if you already have older ones.',
        ],
      },
      {
        title: 'Reset Flow',
        steps: [
          'Use the wipe command only if you understand the data loss.',
          'The CLI can write a timestamped backup into backups/ before deleting the active database.',
          'After wipe, the next server start creates a fresh database and reapplies schema and migrations.',
        ],
        facts: [
          'CLI command: node server/cli.js wipe-database --yes',
          'Lock cleanup targets: -journal, -wal, -shm',
        ],
      },
    ],
  },
  {
    id: 'app-areas',
    eyebrow: 'Section 5',
    title: 'App Areas',
    summary: 'Use this as a quick operator map of what to configure in the main BadShuffle sections.',
    blocks: [
      {
        title: 'Projects And Quotes',
        steps: [
          'Use Projects to create, review, and update quote records.',
          'Open a quote detail page to manage items, venue details, guest counts, and quote-thread workflows.',
          'If Quote AI is enabled, test it from a live quote thread only after Onyx setup is complete.',
        ],
        links: [{ label: 'Projects', href: '/quotes', internal: true }],
      },
      {
        title: 'Messages And Team Chat',
        steps: [
          'Use Messages for inbound and outbound quote-linked communication.',
          'Use Team Chat for internal AI-assisted threads with Onyx-backed responses.',
          'If Team Chat fails, compare the visible thread error with Settings > Onyx and Admin > System.',
        ],
        links: [
          { label: 'Messages', href: '/messages', internal: true },
          { label: 'Team Chat', href: '/team-chat', internal: true },
        ],
      },
      {
        title: 'Inventory',
        steps: [
          'Use Inventory for item records, stock data, pricing, and availability-related setup.',
          'Review Inventory Settings before users depend on default filtering or inventory-specific workflow behavior.',
          'Use Set Aside when items need to be held outside the normal available pool.',
        ],
        links: [
          { label: 'Inventory', href: '/inventory', internal: true },
          { label: 'Inventory Settings', href: '/inventory-settings', internal: true },
        ],
      },
      {
        title: 'Directory And Team',
        steps: [
          'Use Directory for leads, clients, venues, and vendors.',
          'Use Team and Groups to organize people and review access-related workflows.',
          'If records are referenced in Team Chat, mention them by type and id such as quote 12 or client 4.',
        ],
        links: [
          { label: 'Directory', href: '/directory', internal: true },
          { label: 'Team', href: '/team', internal: true },
        ],
      },
      {
        title: 'Files, Templates, Notifications, Extension',
        steps: [
          'Use Files to review uploaded assets and file-serving behavior.',
          'Use Templates for reusable message content where that workflow is enabled.',
          'Use Notification Settings to control delivery behavior and user-facing noise.',
          'Use Extension when connecting the Chrome extension or related external tooling.',
        ],
        links: [
          { label: 'Files', href: '/files', internal: true },
          { label: 'Templates', href: '/templates', internal: true },
          { label: 'Notifications', href: '/settings/notifications', internal: true },
          { label: 'Extension', href: '/extension', internal: true },
        ],
      },
    ],
  },
  {
    id: 'troubleshooting',
    eyebrow: 'Section 6',
    title: 'Troubleshooting',
    summary: 'Work from the symptom. Most failures fall into one of three buckets: app config, runtime health, or bad data.',
    blocks: [
      {
        title: 'Onyx Errors',
        steps: [
          '403 usually means missing or invalid Onyx API token, or a token from the wrong deployment.',
          'Managed local unavailable usually means the runtime is not healthy, not reachable, or not restarted after config changes.',
          'If the browser opens Onyx but BadShuffle fails, test the token and base URL assumptions before changing chat code.',
        ],
      },
      {
        title: 'Database Or Migration Errors',
        steps: [
          'Stop and back up the DB before any manual repair attempt.',
          'Treat new boot failures after an upgrade as schema or migration issues first.',
          'Restore from backup if manual edits made the situation worse.',
        ],
      },
      {
        title: 'Operational Checklist',
        steps: [
          'Check Settings first.',
          'Check Admin > System second.',
          'Check logs and DB backup state before destructive recovery.',
          'Make one controlled change at a time, then retest.',
        ],
      },
    ],
  },
];

function scrollToSection(sectionId) {
  if (!sectionId) return;
  const element = document.getElementById(sectionId);
  if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function LinkPill({ link }) {
  const common = 'inline-flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface hover:text-text';
  if (link.internal) {
    return (
      <a className={common} href={link.href}>
        {link.label}
      </a>
    );
  }
  return (
    <a className={common} href={link.href} target="_blank" rel="noreferrer">
      {link.label}
    </a>
  );
}

function GuideChooser({ selectedId, onSelect, onBegin }) {
  const selectedOption = guideOptions.find((option) => option.id === selectedId) || guideOptions[0];
  return (
    <div className="rounded-[26px] border border-border bg-bg p-5 sm:p-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Guided Setup</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-text">Choose Your Path</div>
      <div className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
        Pick the setup or recovery path that matches your situation, then start the guide. Each step includes a button
        to open the next relevant page or documentation reference.
      </div>
      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {guideOptions.map((option) => {
          const selected = selectedId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`rounded-[22px] border px-4 py-4 text-left transition-colors ${selected ? 'border-primary bg-surface' : 'border-border bg-bg hover:bg-surface'}`}
              onClick={() => onSelect(option.id)}
            >
              <div className="text-sm font-semibold text-text">{option.title}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-text-muted">{option.audience}</div>
              <div className="mt-3 text-sm leading-6 text-text-muted">{option.description}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={onBegin}>
          Begin {selectedOption.title}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => scrollToSection('onyx')}>Open Reference Manual</button>
      </div>
    </div>
  );
}

function GuidedProcess({ option, started, currentStepIndex, onStart, onPrev, onNext, onOpenAction, onJump }) {
  if (!option) return null;
  const step = option.steps[currentStepIndex];
  return (
    <div id="guided-process" className="scroll-mt-24 rounded-[26px] border border-border bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary)_9%,var(--color-bg))_0%,var(--color-bg)_100%)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Active Guide</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-text">{option.title}</div>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{option.description}</div>
        </div>
        <div className="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text-muted">
          Step {currentStepIndex + 1} of {option.steps.length}
        </div>
      </div>

      {!started ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={onStart}>Start This Guide</button>
          <button type="button" className="btn btn-ghost" onClick={() => onJump(option.steps[0].sectionId)}>Jump To Reference</button>
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-[22px] border border-border bg-bg px-5 py-5">
            <div className="text-lg font-semibold tracking-tight text-text">{step.title}</div>
            <div className="mt-2 text-sm leading-6 text-text-muted">{step.description}</div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary" onClick={() => onOpenAction(step)}>
                {step.actionLabel}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => onJump(step.sectionId)}>
                Jump To Reference
              </button>
              <button type="button" className="btn btn-ghost" onClick={onNext}>
                {currentStepIndex + 1 >= option.steps.length ? 'Restart Guide' : 'Mark Complete And Continue'}
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="btn btn-ghost" onClick={onPrev} disabled={currentStepIndex === 0}>
              Previous Step
            </button>
            <button type="button" className="btn btn-ghost" onClick={onNext}>
              {currentStepIndex + 1 >= option.steps.length ? 'Start Over' : 'Next Step'}
            </button>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {option.steps.map((entry, index) => {
              const active = index === currentStepIndex;
              const done = index < currentStepIndex;
              return (
                <button
                  key={`${option.id}-${entry.title}`}
                  type="button"
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${active ? 'border-primary bg-surface' : done ? 'border-border bg-surface' : 'border-border bg-bg hover:bg-surface'}`}
                  onClick={() => onJump(entry.sectionId)}
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    {done ? 'Completed' : active ? 'Current' : `Step ${index + 1}`}
                  </div>
                  <div className="mt-1 text-sm font-medium text-text">{entry.title}</div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SectionNav() {
  return (
    <aside className="self-start rounded-2xl border border-border bg-bg p-4 lg:sticky lg:top-4">
      <div className="text-xs uppercase tracking-[0.18em] text-text-muted">Contents</div>
      <div className="mt-3 flex flex-col gap-2">
        <a href="#guided-help" className="rounded-lg border border-transparent px-3 py-2 text-sm text-text-muted transition-colors hover:border-border hover:bg-surface hover:text-text">Guided Help</a>
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-lg border border-transparent px-3 py-2 text-sm text-text-muted transition-colors hover:border-border hover:bg-surface hover:text-text"
          >
            {section.title}
          </a>
        ))}
      </div>
    </aside>
  );
}

function FactGrid({ facts }) {
  if (!facts?.length) return null;
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact} className="rounded-xl border border-border bg-bg px-3 py-3 text-sm text-text-muted">
          {fact}
        </div>
      ))}
    </div>
  );
}

function StepList({ steps }) {
  if (!steps?.length) return null;
  return (
    <div className="mt-4 space-y-3">
      {steps.map((step, index) => (
        <div key={step} className="flex gap-3 rounded-2xl border border-border bg-surface px-4 py-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-primary)_18%,transparent)] text-sm font-bold text-text">
            {index + 1}
          </div>
          <div className="text-sm leading-6 text-text">{step}</div>
        </div>
      ))}
    </div>
  );
}

function NoteList({ notes }) {
  if (!notes?.length) return null;
  return (
    <div className="mt-4 grid gap-3 xl:grid-cols-2">
      {notes.map((note) => (
        <div key={note} className="rounded-2xl border border-border bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--color-bg))] px-4 py-4 text-sm leading-6 text-text-muted">
          {note}
        </div>
      ))}
    </div>
  );
}

function Block({ block }) {
  return (
    <div className="rounded-[22px] border border-border bg-bg px-5 py-5">
      <div className="text-lg font-semibold tracking-tight text-text">{block.title}</div>
      {block.body ? <div className="mt-2 text-sm leading-6 text-text-muted">{block.body}</div> : null}
      {block.links?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {block.links.map((link) => <LinkPill key={`${block.title}-${link.href}`} link={link} />)}
        </div>
      ) : null}
      <StepList steps={block.steps} />
      <NoteList notes={block.notes} />
      <FactGrid facts={block.facts} />
    </div>
  );
}

function HelpSection({ section }) {
  return (
    <section id={section.id} className="scroll-mt-24 rounded-[26px] border border-border bg-bg p-5 sm:p-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{section.eyebrow}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-text">{section.title}</div>
      <div className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{section.summary}</div>
      {section.links?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {section.links.map((link) => <LinkPill key={`${section.id}-${link.href}`} link={link} />)}
        </div>
      ) : null}
      <div className="mt-5 flex flex-col gap-4">
        {section.blocks.map((block) => <Block key={`${section.id}-${block.title}`} block={block} />)}
      </div>
    </section>
  );
}

export default function HelpPage() {
  const navigate = useNavigate();
  const [selectedGuideId, setSelectedGuideId] = useState(guideOptions[0].id);
  const [guideStarted, setGuideStarted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const selectedGuide = guideOptions.find((option) => option.id === selectedGuideId) || guideOptions[0];

  function openLink(link) {
    if (link.internal) {
      if (link.href.startsWith('#')) {
        scrollToSection(link.href.slice(1));
        return;
      }
      navigate(link.href);
      return;
    }
    window.open(link.href, '_blank', 'noopener,noreferrer');
  }

  function beginGuide() {
    setGuideStarted(true);
    setCurrentStepIndex(0);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => scrollToSection('guided-process'));
    } else {
      scrollToSection('guided-process');
    }
  }

  function openStep(step) {
    openLink({ href: step.actionHref, internal: step.internal });
  }

  function nextStep() {
    if (currentStepIndex + 1 >= selectedGuide.steps.length) {
      setCurrentStepIndex(0);
      return;
    }
    setCurrentStepIndex((current) => current + 1);
  }

  function prevStep() {
    if (currentStepIndex === 0) return;
    setCurrentStepIndex((current) => current - 1);
  }

  function selectGuide(id) {
    setSelectedGuideId(id);
    setGuideStarted(false);
    setCurrentStepIndex(0);
  }

  return (
    <div className="min-h-0 min-w-0">
      <div className="rounded-[28px] border border-border bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_14%,var(--color-bg))_0%,var(--color-bg)_52%,color-mix(in_srgb,var(--color-accent)_10%,var(--color-bg))_100%)] px-5 py-6 sm:px-7 sm:py-8">
        <div className="max-w-4xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-text-muted">Help Center</div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-text sm:text-4xl">Interactive Operator Guide</h1>
          <p className="mt-3 text-sm leading-7 text-text-muted sm:text-[15px]">
            Choose the setup path that matches your environment, then use the guided action buttons to move through
            the next pages and documentation. The full reference manual remains below for deeper reading.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {quickLaunch.map((link) => (
              <button key={link.label} type="button" className="btn btn-ghost" onClick={() => openLink(link)}>
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SectionNav />
        <div className="flex min-w-0 flex-col gap-5">
          <section id="guided-help" className="scroll-mt-24">
            <GuideChooser selectedId={selectedGuideId} onSelect={selectGuide} onBegin={beginGuide} />
          </section>

          <GuidedProcess
            option={selectedGuide}
            started={guideStarted}
            currentStepIndex={currentStepIndex}
            onStart={beginGuide}
            onPrev={prevStep}
            onNext={nextStep}
            onOpenAction={openStep}
            onJump={scrollToSection}
          />

          {sections.map((section) => (
            <HelpSection key={section.id} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}
