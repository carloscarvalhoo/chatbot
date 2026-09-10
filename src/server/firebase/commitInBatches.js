import { adminDb } from "@/server/firebase/admin";

export async function commitInBatches(writeOperations, maxWritesPerBatch = 50) {
  for (let i = 0; i < writeOperations.length; i += maxWritesPerBatch) {
    const batch = adminDb.batch();
    const slice = writeOperations.slice(i, i + maxWritesPerBatch);

    slice.forEach((operation) => {
      if (operation.type === "set") {
        batch.set(operation.ref, operation.data);
      }

      if (operation.type === "delete") {
        batch.delete(operation.ref);
      }
    });

    await batch.commit();
  }
}
