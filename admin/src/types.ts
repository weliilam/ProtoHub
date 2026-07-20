export type EntryType = 'prototype' | 'component' | 'doc' | 'theme' | 'table';

export interface EntryItem {
  name: string;
  title: string;
  type: EntryType;
  url?: string;
  mtime: number;
}

export interface Annotation {
  id: string;
  target: string;
  selector: string;
  x: number;
  y: number;
  text: string;
  status: 'open' | 'done';
  createdAt: string;
}

export interface GitLogItem {
  hash: string;
  date: string;
  message: string;
}

export interface CliStatus {
  label: string;
  available: boolean;
}
