// Utility to format Prisma models for backwards-compatibility with MongoDB frontend expectations

export function formatDoc<T extends Record<string, any>>(doc: T | null | undefined): (T & { _id: string }) | null {
  if (!doc) return null;
  return {
    ...doc,
    _id: doc.id,
  };
}

export function formatDocs<T extends Record<string, any>>(docs: T[] | null | undefined): (T & { _id: string })[] {
  if (!docs) return [];
  return docs.map((doc) => ({
    ...doc,
    _id: doc.id,
  }));
}

export const generateSlug = (name: string): string => {
  if (!name) return 'default-slug';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};
