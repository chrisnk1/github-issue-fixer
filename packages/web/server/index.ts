import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start() {
    const fastify = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info',
        },
    });

    // Register plugins
    await fastify.register(cors, {
        origin: true,
    });

    await fastify.register(websocket);

    // Health check
    fastify.get('/api/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Session routes
    fastify.post('/api/session', async (request, reply) => {
        const { issueUrl } = request.body as { issueUrl: string };

        if (!issueUrl) {
            return reply.code(400).send({ error: 'issueUrl is required' });
        }

        // TODO: Create session and start analysis
        const sessionId = `session-${Date.now()}`;

        return { sessionId, status: 'created' };
    });

    fastify.get('/api/session/:id', async (request) => {
        const { id } = request.params as { id: string };

        // TODO: Get session status
        return {
            id,
            status: 'analyzing',
            progress: 0.3,
        };
    });

    // WebSocket for real-time updates
    fastify.register(async function (fastify) {
        fastify.get('/api/session/:id/stream', { websocket: true }, (connection, req) => {
            const { id } = req.params as { id: string };

            connection.socket.on('message', (message) => {
                // Handle client messages
                console.log('Received:', message.toString());
            });

            // Send updates
            const interval = setInterval(() => {
                connection.socket.send(JSON.stringify({
                    type: 'progress',
                    data: { progress: Math.random() },
                }));
            }, 1000);

            connection.socket.on('close', () => {
                clearInterval(interval);
            });
        });
    });

    // Start server
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`🚀 Server running at http://localhost:${PORT}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

start();
