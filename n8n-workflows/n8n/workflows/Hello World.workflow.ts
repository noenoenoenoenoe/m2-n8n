const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Start', position: [100, 300] }
});

const build_Greeting = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Greeting', parameters: { jsCode: 'return [{ json: { message: "Hello from n8ncli v2", time: new Date().toISOString() } }];' }, position: [220, 0], notes: 'Returns a greeting message with the current timestamp to confirm the CLI push works.', notesInFlow: true }
});

const wf = workflow('o8XDlcOCEnT4kmwK', 'Hello World', { description: 'Test workflow created locally with n8ncli to check that push works.', executionOrder: 'v1', availableInMCP: true });

export default wf
  .add(start)
  .to(build_Greeting)