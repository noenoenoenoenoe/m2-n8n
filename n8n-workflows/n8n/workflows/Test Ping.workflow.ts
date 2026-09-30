const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Start' }
});

const build_Ping = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Ping', parameters: { jsCode: 'return [{ json: { message: "pong from n8ncli test workflow", time: new Date().toISOString() } }];' }, position: [220, 0], notes: 'Returns a simple pong message with a timestamp to confirm the workflow was created and pushed correctly.', notesInFlow: true }
});

const wf = workflow('ZrGWVv4ckMtEWeYX', 'Test Ping', { description: 'Minimal test workflow, triggered manually, used to verify that n8ncli push correctly creates a new workflow in n8n.', executionOrder: 'v1', availableInMCP: true });

export default wf
  .add(start)
  .to(build_Ping)