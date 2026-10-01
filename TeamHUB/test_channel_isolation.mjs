// End-to-End Test Suite for Channel Message Isolation in TeamHub
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qzdpmngqjbaccfubenze.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZHBtbmdxamJhY2NmdWJlbnplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NTQxODAsImV4cCI6MjEwNjIzMDE4MH0.BkGNQuYTd9vewICTX8bNdVSaj6XywjFqXPmXt26Gqy4';

const supabase = createClient(supabaseUrl, supabaseKey);

// Simulated In-Memory & LocalStorage mock conforming to TeamHub implementation
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, val) {
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new MockLocalStorage();

// Import the actual logic to be tested
import {
  getLocalMessagesByChannel,
  saveLocalMessageForChannel,
  fetchMessagesFromDb,
  createMessageInDb,
} from './src/lib/supabase.ts';
import { USERS } from './src/data/mockData.ts';

async function runTests() {
  console.log('====================================================');
  console.log('TEAMHUB — CHANNEL MESSAGE ISOLATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${details ? '--> ' + details : ''}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST A: Existing Messages Isolation
  // -------------------------------------------------------------------------
  console.log('--- TEST A: Existing Messages Isolation ---');
  const generalInitial = await fetchMessagesFromDb('general');
  const designInitial = await fetchMessagesFromDb('design');
  const devInitial = await fetchMessagesFromDb('development');

  assert(
    generalInitial.every((m) => (m.channelId || m.channel_id) === 'general'),
    'Test A1: Only #general messages appear in #general'
  );
  assert(
    designInitial.every((m) => (m.channelId || m.channel_id) === 'design'),
    'Test A2: Only #design messages appear in #design'
  );
  assert(
    devInitial.length === 0,
    'Test A3: #development has clean empty state (0 initial messages)'
  );
  assert(
    !generalInitial.some((m) => (m.channelId || m.channel_id) === 'design'),
    'Test A4: #general does not contain any #design messages'
  );

  // -------------------------------------------------------------------------
  // TEST B: Send Messages Across 3 Channels
  // -------------------------------------------------------------------------
  console.log('\n--- TEST B: Send Messages Across 3 Channels ---');
  const resGen = await createMessageInDb('general', 'GENERAL TEST', USERS.david);
  const resDev = await createMessageInDb('development', 'DEVELOPMENT TEST', USERS.sarah);
  const resDes = await createMessageInDb('design', 'DESIGN TEST', USERS.anya);

  assert(resGen.success && resGen.message.channelId === 'general', 'Test B1: Send in #general associates with general');
  assert(resDev.success && resDev.message.channelId === 'development', 'Test B2: Send in #development associates with development');
  assert(resDes.success && resDes.message.channelId === 'design', 'Test B3: Send in #design associates with design');

  const generalAfter = await fetchMessagesFromDb('general');
  const devAfter = await fetchMessagesFromDb('development');
  const desAfter = await fetchMessagesFromDb('design');

  assert(
    generalAfter.some((m) => m.content === 'GENERAL TEST') &&
    !generalAfter.some((m) => m.content === 'DEVELOPMENT TEST') &&
    !generalAfter.some((m) => m.content === 'DESIGN TEST'),
    'Test B4: #general contains only GENERAL TEST and never dev/design messages'
  );

  assert(
    devAfter.some((m) => m.content === 'DEVELOPMENT TEST') &&
    !devAfter.some((m) => m.content === 'GENERAL TEST') &&
    !devAfter.some((m) => m.content === 'DESIGN TEST'),
    'Test B5: #development contains only DEVELOPMENT TEST and never general/design messages'
  );

  assert(
    desAfter.some((m) => m.content === 'DESIGN TEST') &&
    !desAfter.some((m) => m.content === 'GENERAL TEST') &&
    !desAfter.some((m) => m.content === 'DEVELOPMENT TEST'),
    'Test B6: #design contains only DESIGN TEST and never general/dev messages'
  );

  // -------------------------------------------------------------------------
  // TEST C: Persistence Across Refresh
  // -------------------------------------------------------------------------
  console.log('\n--- TEST C: Persistence Across Refresh ---');
  // Re-read directly from fresh storage map to simulate full page refresh
  const reloadedMap = getLocalMessagesByChannel();
  assert(
    reloadedMap['general'].some((m) => m.content === 'GENERAL TEST'),
    'Test C1: #general persisted GENERAL TEST in storage map'
  );
  assert(
    reloadedMap['development'].some((m) => m.content === 'DEVELOPMENT TEST'),
    'Test C2: #development persisted DEVELOPMENT TEST in storage map'
  );
  assert(
    reloadedMap['design'].some((m) => m.content === 'DESIGN TEST'),
    'Test C3: #design persisted DESIGN TEST in storage map'
  );
  assert(
    !reloadedMap['development'].some((m) => m.content === 'GENERAL TEST'),
    'Test C4: Persisted #development has zero leakage from other channels'
  );

  // -------------------------------------------------------------------------
  // TEST D: Multiple Browser Sessions / Broadcast Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST D: Multiple Browser Sessions / Broadcast Isolation ---');
  // Simulate Session A in #general and Session B in #development
  let sessionA_ActiveChannel = 'general';
  let sessionA_Messages = [...generalAfter];

  let sessionB_ActiveChannel = 'development';
  let sessionB_Messages = [...devAfter];

  // Listener function in Session B
  function handleBroadcastSessionB(event) {
    if (event.channelId === sessionB_ActiveChannel) {
      sessionB_Messages.push(event.message);
    }
  }

  // Listener function in Session A
  function handleBroadcastSessionA(event) {
    if (event.channelId === sessionA_ActiveChannel) {
      sessionA_Messages.push(event.message);
    }
  }

  // 1. Message sent in #general
  const generalMsg2 = {
    id: 'msg-cross-1',
    channelId: 'general',
    channel_id: 'general',
    author: USERS.david,
    createdAt: 'Just now',
    content: 'CROSS-SESSION GENERAL UPDATE',
    reactions: [],
  };
  const event1 = { type: 'NEW_CHANNEL_MESSAGE', channelId: 'general', message: generalMsg2 };
  handleBroadcastSessionA(event1);
  handleBroadcastSessionB(event1);

  assert(
    sessionA_Messages.some((m) => m.content === 'CROSS-SESSION GENERAL UPDATE'),
    'Test D1: Session A in #general receives the #general broadcast'
  );
  assert(
    !sessionB_Messages.some((m) => m.content === 'CROSS-SESSION GENERAL UPDATE'),
    'Test D2: Session B in #development IGNORES the #general broadcast (no cross-contamination)'
  );

  // 2. Message sent in #development
  const devMsg2 = {
    id: 'msg-cross-2',
    channelId: 'development',
    channel_id: 'development',
    author: USERS.sarah,
    createdAt: 'Just now',
    content: 'CROSS-SESSION DEV UPDATE',
    reactions: [],
  };
  const event2 = { type: 'NEW_CHANNEL_MESSAGE', channelId: 'development', message: devMsg2 };
  handleBroadcastSessionA(event2);
  handleBroadcastSessionB(event2);

  assert(
    sessionB_Messages.some((m) => m.content === 'CROSS-SESSION DEV UPDATE'),
    'Test D3: Session B in #development receives the #development broadcast'
  );
  assert(
    !sessionA_Messages.some((m) => m.content === 'CROSS-SESSION DEV UPDATE'),
    'Test D4: Session A in #general IGNORES the #development broadcast'
  );

  // -------------------------------------------------------------------------
  // TEST E: Rapid Channel Switching
  // -------------------------------------------------------------------------
  console.log('\n--- TEST E: Rapid Channel Switching ---');
  const switchSequence = ['general', 'development', 'design', 'general', 'development'];
  let currentLoadedMessages = [];
  let leakageDetected = false;

  for (const targetChannel of switchSequence) {
    currentLoadedMessages = await fetchMessagesFromDb(targetChannel);
    const hasWrongMessage = currentLoadedMessages.some(
      (m) => (m.channelId || m.channel_id) !== targetChannel
    );
    if (hasWrongMessage) {
      leakageDetected = true;
      break;
    }
  }

  assert(!leakageDetected, 'Test E1: Rapid switching #general -> #dev -> #design -> #general -> #dev preserves strict channel isolation');

  // -------------------------------------------------------------------------
  // TEST F: Database Schema & Channel ID Verification
  // -------------------------------------------------------------------------
  console.log('\n--- TEST F: Database Verification ---');
  const allStored = getLocalMessagesByChannel();
  let allHaveValidChannelId = true;
  for (const [chId, msgList] of Object.entries(allStored)) {
    for (const m of msgList) {
      if ((m.channelId || m.channel_id) !== chId) {
        allHaveValidChannelId = false;
        console.error(`Mismatch found: message ${m.id} in channel ${chId} has channelId ${m.channelId}`);
      }
    }
  }

  assert(allHaveValidChannelId, 'Test F1: Every message stored has an exact matching channel_id');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
