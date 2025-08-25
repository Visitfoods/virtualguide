import { NextResponse } from 'next/server';
import { getAmenFtpConfig } from '@/lib/amenFtp';
import { Client } from 'basic-ftp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Aumentar o tempo máximo para 60 segundos

export async function GET() {
	try {
		// Obter configuração FTP
		console.log('Obtendo configuração FTP...');
		const config = getAmenFtpConfig();
		
		// Testar ligação
		console.log('Criando cliente FTP...');
		const client = new Client();
		client.ftp.verbose = true; // Ativar logs verbosos
		
		console.log('Tentando conectar a:', config.host, 'como', config.user);
		
		try {
			await client.access({
				host: config.host,
				user: config.user,
				password: config.password,
				port: config.port,
				secure: config.secure,
			});
		} catch (connectionError) {
			console.error('Erro na conexão FTP:', connectionError);
			return NextResponse.json({
				success: false,
				error: connectionError instanceof Error ? connectionError.message : 'Erro na conexão',
				message: 'Falha na ligação FTP. Verifique as credenciais e configurações.',
				config: {
					host: config.host,
					user: config.user,
					port: config.port,
					secure: config.secure,
					publicHtmlPath: config.publicHtmlPath,
					baseUrl: config.baseUrl
				}
			}, { status: 500 });
		}

		console.log('Conectado com sucesso!');
		
		// Listar diretório atual
		console.log('Listando diretório atual...');
		const initialDir = await client.pwd();
		console.log('Diretório atual:', initialDir);
		
		const list = await client.list();
		console.log('Conteúdo do diretório:', list.map(i => i.name).join(', '));
		
		// Tentar criar pasta guides se não existir
		try {
			console.log('Verificando se pasta guides existe...');
			await client.cd('guides');
			console.log('Pasta guides já existe!');
		} catch (e) {
			console.log('Pasta guides não existe, criando...');
			await client.mkdir('guides');
			await client.cd('guides');
			console.log('Pasta guides criada e acessada!');
		}
		
		// Tentar criar pasta de teste
		const testFolder = 'test-connection';
		try {
			console.log(`Verificando se pasta ${testFolder} existe...`);
			await client.cd(testFolder);
			console.log(`Pasta ${testFolder} já existe!`);
			// Voltar para o diretório anterior
			await client.cdup();
		} catch (e) {
			console.log(`Pasta ${testFolder} não existe, criando...`);
			await client.mkdir(testFolder);
			console.log(`Pasta ${testFolder} criada!`);
		}
		
		// Voltar para o diretório raiz
		await client.cd(initialDir);
		
		// Fechar conexão
		client.close();

		return NextResponse.json({
			success: true,
			message: 'Ligação FTP bem-sucedida!',
			config: {
				host: config.host,
				user: config.user,
				port: config.port,
				secure: config.secure,
				publicHtmlPath: config.publicHtmlPath,
				baseUrl: config.baseUrl
			},
			initialDirectory: initialDir,
			directoryContents: list.map(item => ({
				name: item.name,
				type: item.type,
				size: item.size
			}))
		});

	} catch (error) {
		console.error('Erro no teste FTP:', error);
		return NextResponse.json({
			success: false,
			error: error instanceof Error ? error.message : 'Erro desconhecido',
			message: 'Falha na ligação FTP. Verifique as configurações.',
			environmentVariables: {
				FTP_HOST_EXISTS: !!process.env.FTP_HOST,
				FTP_USER_EXISTS: !!process.env.FTP_USER,
				FTP_PASSWORD_EXISTS: !!process.env.FTP_PASSWORD,
				FTP_PORT_EXISTS: !!process.env.FTP_PORT,
				FTP_SECURE_EXISTS: !!process.env.FTP_SECURE,
				FTP_BASE_URL_EXISTS: !!process.env.FTP_BASE_URL,
			}
		}, { status: 500 });
	}
}