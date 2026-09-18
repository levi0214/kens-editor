import assert from "node:assert/strict";
import test from "node:test";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import {
  getVaultDocumentCount,
  refreshVaultDocumentCount,
  listVaultDocuments,
  createVaultDocument,
  deleteVaultDocument,
  toggleVaultDocumentPin,
} from "../src/vault.ts";

globalThis.window = {};

test("only the count is cached; each list open loads fresh contents", async () => {
  const commands = [];
  let count = 2;
  mockIPC((command) => {
    commands.push(command);
    if (command === "count_vault_documents") return count;
    if (command === "list_vault_documents") {
      return Array.from({ length: count }, (_, index) => ({ path: String(index) }));
    }
    if (command === "create_vault_document") { count += 1; return "new"; }
    if (command === "delete_vault_document") count -= 1;
    if (command === "toggle_vault_document_pin") return true;
  });

  assert.equal(getVaultDocumentCount(), null);
  await refreshVaultDocumentCount();
  assert.equal(getVaultDocumentCount(), 2);
  assert.deepEqual(commands, ["count_vault_documents"], "preload reads no contents");
  await listVaultDocuments();
  await listVaultDocuments();
  assert.equal(commands.filter((command) => command === "list_vault_documents").length, 2);
  await createVaultDocument();
  assert.equal(getVaultDocumentCount(), 3);
  await deleteVaultDocument("new");
  assert.equal(getVaultDocumentCount(), 2);
  const beforePin = commands.length;
  await toggleVaultDocumentPin("0");
  assert.deepEqual(commands.slice(beforePin), ["toggle_vault_document_pin"]);

  const reads = [];
  mockIPC(() => new Promise((resolve) => reads.push(resolve)));
  const older = refreshVaultDocumentCount();
  assert.equal(getVaultDocumentCount(), null, "opening during refresh must not use the old size");
  const newer = refreshVaultDocumentCount();
  reads[1](4);
  await newer;
  reads[0](3);
  await older;
  assert.equal(getVaultDocumentCount(), 4, "old counts cannot overwrite a newer refresh");

  const pendingCount = refreshVaultDocumentCount();
  const list = listVaultDocuments();
  reads[3]([{ path: "one" }]);
  await list;
  reads[2](5);
  await pendingCount;
  assert.equal(getVaultDocumentCount(), 1, "loaded list corrects a stale count");

  mockIPC(() => { throw new Error("read failed"); });
  await refreshVaultDocumentCount();
  assert.equal(getVaultDocumentCount(), null, "unknown count uses the cold-start fallback");
  mockIPC(() => 0);
  await refreshVaultDocumentCount();
  assert.equal(getVaultDocumentCount(), 0, "empty is different from unknown");
  clearMocks();
});
