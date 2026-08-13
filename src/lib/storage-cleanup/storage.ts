export type StorageApi = {
  from: (bucketId: string) => {
    remove: (objectPaths: string[]) => Promise<{ error: unknown | null }>;
  };
};

export async function removeExactQueuedObject(
  storage: StorageApi,
  bucketId: string,
  objectPath: string,
): Promise<void> {
  const { error } = await storage.from(bucketId).remove([objectPath]);
  if (error) throw error;
}
