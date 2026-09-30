const erreur_chec_workflow_tri_mails = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: { name: 'Erreur - Échec workflow tri mails' }
});

const slack_Alerter_No = node({
  type: 'n8n-nodes-base.slack',
  version: 2.7,
  config: { name: 'Slack - Alerter Noé', parameters: { authentication: 'oAuth2', select: 'user', user: { __rl: true, value: 'U0EXEMPLE04', mode: 'list', cachedResultName: 'Noé Escoffier-Vincent (@noe.escoffier-vincent)' }, text: '⚠️ Échec du workflow de tri des mails', otherOptions: {} }, credentials: { slackOAuth2Api: newCredential('Slack account', 'CREDENTIAL_ID') }, position: [224, 0], webhookId: '00000000-0000-0000-0000-000000000000' }
});

const wf = workflow('qxiolQ3TqUKnBt4v', 'Support - Alerte erreurs', { executionOrder: 'v1', binaryMode: 'separate', availableInMCP: true });

export default wf
  .add(erreur_chec_workflow_tri_mails)
  .to(slack_Alerter_No)