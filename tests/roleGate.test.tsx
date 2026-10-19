// A15 — a learner account cannot reach the review queue.
//
// Tested through the rendered app rather than against a predicate, because the criterion is
// about what a person at the device can reach. A unit test on isTeacher() would pass even if
// the review screen were wide open.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import App from '../App';
import { AppMode, Role } from '../types';
import { createAccount, signIn } from '../services/accountStore';
import { saveProfile } from '../services/profileStore';
import { generateForReview } from '../services/generateForReview';
import { profile, stubFetch } from './helpers';

async function signedInAs(role: Role) {
  const username = role === Role.TEACHER ? 'teacher.rao' : 'learner.meera';
  const account = await createAccount(username, 'pw', role);
  await signIn(username, 'pw');
  saveProfile(account.id, profile());
  return account;
}

describe('test_learner_cannot_review (A15)', () => {
  beforeEach(() => {
    stubFetch();
  });

  it('a learner sees no Review control', async () => {
    const account = await signedInAs(Role.LEARNER);
    await generateForReview({
      mode: AppMode.HEAR_IMAGES,
      mediaBase64: 'MEDIA',
      mimeType: 'image/jpeg',
      prefs: profile(),
      learnerAccountId: account.id,
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText(/What magic shall we learn today/i)).toBeDefined());
    expect(screen.queryByRole('button', { name: /^Review$/ })).toBeNull();
  });

  it('a teacher does see it', async () => {
    await signedInAs(Role.TEACHER);

    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Review$/ })).toBeDefined()
    );
  });

  it('a pending item is not rendered to the learner anywhere on the page', async () => {
    const account = await signedInAs(Role.LEARNER);
    await generateForReview({
      mode: AppMode.HEAR_IMAGES,
      mediaBase64: 'MEDIA',
      mimeType: 'image/jpeg',
      prefs: profile(),
      learnerAccountId: account.id,
    });

    const { container } = render(<App />);

    await waitFor(() => expect(screen.getByText(/What magic shall we learn today/i)).toBeDefined());
    // The model output from tests/helpers. If the gate leaks, this text is on screen.
    expect(container.textContent).not.toContain('A leaf cross-section');
    expect(container.textContent).not.toContain('tamarind leaf');
    expect(screen.queryByText(/Ready for you/i)).toBeNull();
  });

  it('an unsigned device shows the login screen, not the app', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByLabelText(/Create an account|Sign in/i)).toBeDefined());
    expect(screen.queryByText(/What magic shall we learn today/i)).toBeNull();
  });
});
