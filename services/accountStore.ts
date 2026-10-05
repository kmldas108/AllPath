// The device's account list. One teacher and one or more learners share a tablet; each signs
// in as themselves (spec 10a). Nothing here is transmitted and nothing here reaches a server:
// accounts are local to the device, which is what keeps C4 and C5 true.

import { Account, Role } from '../types';
import { hashPassword, verifyPassword } from './credentials';

const ACCOUNTS_KEY = 'allpath.accounts';
const SESSION_KEY = 'allpath.session';

function read(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as Account[]) : [];
  } catch {
    return [];
  }
}

function write(accounts: Account[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function listAccounts(): Account[] {
  return read();
}

export function hasAnyAccount(): boolean {
  return read().length > 0;
}

export async function createAccount(
  username: string,
  password: string,
  role: Role
): Promise<Account> {
  const accounts = read();
  const name = username.trim();
  if (!name) throw new Error('A username is required.');
  if (!password) throw new Error('A password is required.');
  if (accounts.some((a) => a.username.toLowerCase() === name.toLowerCase())) {
    throw new Error('That username is already on this device.');
  }
  const { salt, hash } = await hashPassword(password);
  const account: Account = {
    id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    username: name,
    role,
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };
  write([...accounts, account]);
  return account;
}

/** Returns the account on success, null on a wrong username or password. */
export async function signIn(username: string, password: string): Promise<Account | null> {
  const account = read().find(
    (a) => a.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (!account) return null;
  const ok = await verifyPassword(password, account.salt, account.hash);
  if (!ok) return null;
  localStorage.setItem(SESSION_KEY, account.id);
  return account;
}

export function signOut(): void {
  localStorage.removeItem(SESSION_KEY);
}

/** The account signed in on this device, if any. Survives a reload; cleared by sign-out. */
export function currentAccount(): Account | null {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  return read().find((a) => a.id === id) ?? null;
}

export function isTeacher(account: Account | null): boolean {
  return account?.role === Role.TEACHER;
}
