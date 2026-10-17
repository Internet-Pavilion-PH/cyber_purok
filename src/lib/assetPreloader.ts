export type AssetPreloadTask = Promise<unknown> | (() => Promise<unknown>) | null | undefined;

export async function preloadAssets(tasks: AssetPreloadTask[]): Promise<void> {
  const queuedTasks = tasks.filter((task): task is Promise<unknown> | (() => Promise<unknown>) => !!task);

  await Promise.all(
    queuedTasks.map((task) => {
      if (typeof task === "function") {
        return task();
      }

      return task;
    }),
  );
}
