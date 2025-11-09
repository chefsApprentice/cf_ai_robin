import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { nanoid } from 'nanoid';
import { DatabaseService } from './services/database';
import { ResponseHandler } from './utils/response';
import {
	ROUTES,
	AI_TAGS_CONFIG,
	AI_ALT_TEXT_CONFIG
} from './config';
import {
	Env,
	WorkflowParams,
	ApprovalRequest,
	TagsResponse,
	WorkflowStatus,
	AltTextResponse
} from './types';

export class MyWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
	private db!: DatabaseService;

	async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
		this.db = new DatabaseService(this.env.DB)

		const { imageKey } = event.payload;

		await step.do('Insert image name into database', async () => {
			await this.db.insertImage(imageKey, event.instanceId);
		});

		const waitForTagApproval = await step.waitForEvent('Wait for AI Image tagging approval', {
			type: 'approval-for-ai-tagging',
			timeout: '5 minute',
		});

		const approvalTagsPayload = waitForTagApproval.payload as ApprovalRequest;
		if (approvalTagsPayload?.approved) {
			const aiTags = await step.do('Generate AI tags', async () => {
				const image = await this.env.workflow_demo_bucket.get(imageKey);
				if (!image) throw new Error('Image not found');

				const arrayBuffer = await image.arrayBuffer();
				const uint8Array = new Uint8Array(arrayBuffer);

				const input = {
					image: Array.from(uint8Array),
					prompt: AI_TAGS_CONFIG.PROMPT,
					max_tokens: AI_TAGS_CONFIG.MAX_TOKENS,
				};

				const response = await this.env.AI.run(AI_TAGS_CONFIG.MODEL, input);
				return response.description;
			});

			await step.do('Update DB with AI tags', async () => {
				await this.db.updateImageTags(event.instanceId, aiTags);
			});
		}

		const waitForAltTextApproval = await step.waitForEvent('Wait for AI Image alt text approval', {
			type: 'approval-for-ai-alttext',
			timeout: '5 minute',
		});

		const approvalAltTextPayload = waitForAltTextApproval.payload as ApprovalRequest;
		if (approvalAltTextPayload?.approved) {
			const aiAltText = await step.do('Generate AI Alt Text', async () => {
				const image = await this.env.workflow_demo_bucket.get(imageKey);
				if (!image) throw new Error('Image not found');

				const arrayBuffer = await image.arrayBuffer();
				const uint8Array = new Uint8Array(arrayBuffer);

				const input = {
					image: Array.from(uint8Array),
					prompt: AI_ALT_TEXT_CONFIG.PROMPT,
					max_tokens: AI_ALT_TEXT_CONFIG.MAX_TOKENS,
				};

				const response = await this.env.AI.run(AI_ALT_TEXT_CONFIG.MODEL, input);
				return response.description;
			});

			await step.do('Update DB with AI Alt text', async () => {
				await this.db.updateImageAltText(event.instanceId, aiAltText);
			});
		}

	}
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		const db = new DatabaseService(env.DB);

		// Handle OPTIONS request for CORS preflight
		if (req.method === 'OPTIONS') {
			return ResponseHandler.corsPreflight();
		}

		// Handle /tags endpoint
		if (url.pathname === ROUTES.TAGS) {
			const instanceId = url.searchParams.get('instanceId');
			if (!instanceId) {
				return ResponseHandler.badRequest('Missing instanceId parameter');
			}

			try {
				const tags = await db.getImageTags(instanceId);
				return ResponseHandler.success<TagsResponse>({
					instanceId,
					tags,
				});
			} catch (error) {
				console.error('Error fetching tags:', error);
				return ResponseHandler.error('Error fetching tags');
			}
		}

		// Handle /approval-for-ai-tagging endpoint
		if (url.pathname === ROUTES.TAG_APPROVAL) {
			if (req.method !== 'POST') {
				return ResponseHandler.methodNotAllowed();
			}

			try {
				const body = await req.json() as ApprovalRequest;
				const { instanceId, approved } = body;

				if (!instanceId || typeof approved !== 'boolean') {
					return ResponseHandler.badRequest('Missing or invalid parameters');
				}

				const instance = await env.MY_WORKFLOW.get(instanceId);
				await instance.sendEvent({
					type: "approval-for-ai-tagging",
					payload: { approved },
				});

				return ResponseHandler.success({ success: true });
			} catch (error) {
				console.error('Error processing approval:', error);
				return ResponseHandler.error('Error processing approval');
			}
		}

		// Handle Creating new image Workflow
		if (req.method === 'POST' && url.pathname === '/') {
			try {
				const contentType = req.headers.get('content-type');
				if (!contentType || !contentType.includes('multipart/form-data')) {
					return ResponseHandler.badRequest('Invalid content type. Expected multipart/form-data');
				}

				const formData = await req.formData();
				const image = formData.get('image') as File;

				if (!image || !(image instanceof File)) {
					return ResponseHandler.badRequest('Missing or invalid image file');
				}

				const imageKey = nanoid();
				await env.workflow_demo_bucket.put(imageKey, image);

				const instance = await env.MY_WORKFLOW.create({
					params: { imageKey },
				});

				return ResponseHandler.success<WorkflowStatus>({
					id: instance.id,
					details: await instance.status(),
					success: true,
					message: 'Image upload started successfully',
				});
			} catch (error) {
				console.error('Error processing image upload:', error);
				return ResponseHandler.error('Error processing image upload');
			}
		}

		// Handle /tags endpoint
		if (url.pathname === ROUTES.TAGS) {
			const instanceId = url.searchParams.get('instanceId');
			if (!instanceId) {
				return ResponseHandler.badRequest('Missing instanceId parameter');
			}

			try {
				const tags = await db.getImageTags(instanceId);
				return ResponseHandler.success<TagsResponse>({
					instanceId,
					tags,
				});
			} catch (error) {
				console.error('Error fetching tags:', error);
				return ResponseHandler.error('Error fetching tags');
			}
		}

		// Handle /approval-for-ai-tagging endpoint
		if (url.pathname === ROUTES.TAG_APPROVAL) {
			if (req.method !== 'POST') {
				return ResponseHandler.methodNotAllowed();
			}

			try {
				const body = await req.json() as ApprovalRequest;
				const { instanceId, approved } = body;

				if (!instanceId || typeof approved !== 'boolean') {
					return ResponseHandler.badRequest('Missing or invalid parameters');
				}

				const instance = await env.MY_WORKFLOW.get(instanceId);
				await instance.sendEvent({
					type: "approval-for-ai-tagging",
					payload: { approved },
				});

				return ResponseHandler.success({ success: true });
			} catch (error) {
				console.error('Error processing approval:', error);
				return ResponseHandler.error('Error processing approval');
			}
		}


		// Handle /alt text endpoint
		if (url.pathname === ROUTES.ALTTEXT) {
			const instanceId = url.searchParams.get('instanceId');
			if (!instanceId) {
				return ResponseHandler.badRequest('Missing instanceId parameter');
			}

			try {
				const altText = await db.getImageAltText(instanceId);
				return ResponseHandler.success<AltTextResponse>({
					instanceId,
					altText
				});
			} catch (error) {
				console.error('Error fetching alt text:', error);
				return ResponseHandler.error('Error fetching alt text');
			}
		}

		// Handle /approval-for-ai-tagging endpoint
		if (url.pathname === ROUTES.ALTTEXT_APPROVAL) {
			if (req.method !== 'POST') {
				return ResponseHandler.methodNotAllowed();
			}

			try {
				const body = await req.json() as ApprovalRequest;
				const { instanceId, approved } = body;

				if (!instanceId || typeof approved !== 'boolean') {
					return ResponseHandler.badRequest('Missing or invalid parameters');
				}

				const instance = await env.MY_WORKFLOW.get(instanceId);
				await instance.sendEvent({
					type: "approval-for-ai-alttext",
					payload: { approved },
				});

				return ResponseHandler.success({ success: true });
			} catch (error) {
				console.error('Error processing approval:', error);
				return ResponseHandler.error('Error processing approval');
			}
		}

		// Get the status of an existing instance
		if (req.method === 'GET' && url.pathname === '/') {
			const instanceId = url.searchParams.get('instanceId');
			if (!instanceId) {
				return ResponseHandler.badRequest('Missing instanceId parameter');
			}

			try {
				const instance = await env.MY_WORKFLOW.get(instanceId);
				const status = await instance.status();
				return ResponseHandler.success<WorkflowStatus>(status);
			} catch (error) {
				console.error('Error getting workflow status:', error);
				return ResponseHandler.error('Error getting workflow status');
			}
		}

		// Handle favicon requests
		if (url.pathname.startsWith('/favicon')) {
			return ResponseHandler.notFound();
		}


		return ResponseHandler.badRequest('Invalid Request');
	},
};
