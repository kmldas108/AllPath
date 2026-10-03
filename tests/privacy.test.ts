// A7, A8, A16, A17 — the profile stays on the device and the name never leaves it.

import { describe, it, expect } from 'vitest';
import { AppMode, Role, UserDisability } from '../types';
import { generateForReview } from '../services/generateForReview';
import { loadProfile, saveProfile, forGeneration } from '../services/profileStore';
import { createAccount, signIn, signOut, currentAccount } from '../services/accountStore';
import { sendChatMessage } from '../services/geminiService';
import { ALL_MODES, LEARNER_ID, profile, stubFetch, modelOutput } from './helpers';

const NAME = 'Meera';

describe('test_name_never_leaves (A7)', () => {
  for (const mode of ALL_MODES) {
    it(`no request body contains the learner's name in ${mode}`, async () => {
      const { bodies } = stubFetch(modelOutput({ mode }));

      await generateForReview({
        mode,
        mediaBase64: mode === AppMode.CLASS_PACK ? null : 'MEDIA',
        mimeType: 'image/jpeg',
        prefs: profile({ name: NAME }),
        learnerAccountId: LEARNER_ID,
        classPackData:
          mode === AppMode.CLASS_PACK
            ? {
                subject: 'Science',
                topic: 'Water Cycle',
                performance: 'Strong',
                parentLanguage: 'Kannada',
              }
            : undefined,
      });

      expect(bodies.length).toBe(1);
      // Scan the whole serialised body, not just the prefs object: the point is that the
      // name is nowhere on the wire, however the payload is shaped.
      expect(JSON.stringify(bodies[0])).not.toContain(NAME);
      expect(bodies[0].prefs.name).toBeUndefined();
      expect(bodies[0].prefs.language).toBe('Kannada'); // the rest still goes
    });
  }

  it('holds for the chat endpoint too, where the full profile used to be passed', async () => {
    const { bodies } = stubFetch();
    // Deliberately handing over the whole UserPreferences, name included — the kind of call
    // site that typechecks but would leak if stripping were left to the caller.
    await sendChatMessage([], 'hello', null, modelOutput(), profile({ name: NAME }));

    expect(JSON.stringify(bodies[0])).not.toContain(NAME);
  });

  it('forGeneration drops the name and keeps everything else', () => {
    const wire = forGeneration(profile({ name: NAME }));
    expect((wire as Record<string, unknown>).name).toBeUndefined();
    expect(wire.grade).toBe('Grade 6');
    expect(wire.disability).toBe(UserDisability.VISUAL);
  });
});

describe('test_profile_persists_locally (A8)', () => {
  it('a saved profile is readable again with no network call', async () => {
    const { fetchMock } = stubFetch();
    saveProfile(LEARNER_ID, profile({ name: NAME }));

    // Simulating a reload: nothing in memory, read straight from the device.
    const loaded = loadProfile(LEARNER_ID);

    expect(loaded!.name).toBe(NAME);
    expect(loaded!.language).toBe('Kannada');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an unknown account has no profile, so onboarding still runs for a new learner', () => {
    expect(loadProfile('acc_nobody')).toBeNull();
  });
});

describe('test_profile_is_per_account (A16)', () => {
  it('a second learner gets their own profile, not the previous one', async () => {
    saveProfile('acc_a', profile({ name: 'Meera', language: 'Kannada' }));
    saveProfile('acc_b', profile({ name: 'Arun', language: 'Tamil' }));

    expect(loadProfile('acc_a')!.language).toBe('Kannada');
    expect(loadProfile('acc_b')!.language).toBe('Tamil');
    expect(loadProfile('acc_b')!.name).toBe('Arun');
  });
});

describe('test_credentials_stay_local (A17)', () => {
  it('no password is recoverable from storage', async () => {
    await createAccount('teacher.rao', 'correct horse battery', Role.TEACHER);

    // Read every key the device holds, rather than trusting one shape of storage.
    const everythingStored = Object.keys(localStorage)
      .map((k) => `${k}=${localStorage.getItem(k)}`)
      .join(' | ');
    expect(everythingStored).not.toContain('correct horse battery');
    expect(everythingStored).toContain('teacher.rao'); // the account itself is there
  });

  it('the right password signs in and the wrong one does not', async () => {
    await createAccount('teacher.rao', 'correct horse battery', Role.TEACHER);

    expect(await signIn('teacher.rao', 'wrong')).toBeNull();
    const ok = await signIn('teacher.rao', 'correct horse battery');
    expect(ok).not.toBeNull();
    expect(currentAccount()!.username).toBe('teacher.rao');

    signOut();
    expect(currentAccount()).toBeNull();
  });

  it('signing in sends nothing to a server', async () => {
    const { fetchMock } = stubFetch();
    await createAccount('learner.meera', 'pw', Role.LEARNER);
    await signIn('learner.meera', 'pw');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
