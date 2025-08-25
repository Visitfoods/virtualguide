import { Client, AccessOptions } from 'basic-ftp';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type FtpSecureMode = boolean | 'implicit';

function getEnv(name: string, required = true): string | undefined {
	const value = process.env[name];
	if (required && (!value || value.trim() === '')) {
		console.error(`Variável de ambiente em falta: ${name}`);
		throw new Error(`Variável de ambiente em falta: ${name}`);
	}
	return value;
}

function toBool(value: string | undefined): boolean | undefined {
	if (value === undefined) return undefined;
	return /^(1|true|yes)$/i.test(value.trim());
}

export interface AmenFtpConfig {
	host: string;
	user: string;
	password: string;
	port?: number;
	secure?: FtpSecureMode;
	publicHtmlPath?: string; // ex: 'public_html' | '.' | '/home/user/public_html'
	baseUrl: string; // ex: 'https://seudominio.com'
}

// Valores padrão para ambiente de produção caso as variáveis não estejam disponíveis
const defaultConfig: AmenFtpConfig = {
	host: 'lhwp3192.webapps.net',
	user: 'virtualguide@visitfoods.pt',
	password: 'conTaSuper78%',
	port: 21,
	secure: false,
	publicHtmlPath: '.',
	baseUrl: 'https://visitfoods.pt'
};

export function getAmenFtpConfig(): AmenFtpConfig {
	try {
		// Tentar obter valores das variáveis de ambiente
		const host = getEnv('FTP_HOST', false) || defaultConfig.host;
		const user = getEnv('FTP_USER', false) || defaultConfig.user;
		const password = getEnv('FTP_PASSWORD', false) || defaultConfig.password;
		const port = process.env.FTP_PORT ? Number(process.env.FTP_PORT) : defaultConfig.port;
		
		const secureEnv = process.env.FTP_SECURE;
		let secure: FtpSecureMode = defaultConfig.secure;
		if (secureEnv) {
			if (secureEnv.toLowerCase() === 'implicit') secure = 'implicit';
			else secure = toBool(secureEnv) ?? defaultConfig.secure;
		}
		
		// Permitir vazio (raiz), relativo ou absoluto
		const publicHtmlPath = process.env.FTP_PUBLIC_HTML_PATH ?? defaultConfig.publicHtmlPath;
		const baseUrl = getEnv('FTP_BASE_URL', false) || defaultConfig.baseUrl;
		
		console.log('FTP Config:', { host, user, port, secure, publicHtmlPath, baseUrl });
		
		return { host, user, password, port, secure, publicHtmlPath, baseUrl };
	} catch (error) {
		console.error('Erro ao obter configuração FTP:', error);
		console.log('Usando configuração padrão');
		return { ...defaultConfig };
	}
}

async function connectClient(config: AmenFtpConfig): Promise<Client> {
	const client = new Client();
	client.ftp.verbose = true; // Ativar logs verbosos para debug
	const access: AccessOptions = {
		host: config.host,
		user: config.user,
		password: config.password,
		secure: config.secure,
		port: config.port,
	};
	await client.access(access);
	return client;
}

export async function uploadBufferToAmen(relativePathUnderPublicHtml: string, buffer: Buffer): Promise<string> {
	const config = getAmenFtpConfig();
	const client = await connectClient(config);
	try {
		// Garante diretório remoto
		const normalized = relativePathUnderPublicHtml.replace(/^\/+/, '');
		const parts = normalized.split('/');
		const fileName = parts.pop() as string;
		
		// Guardar diretório inicial
		const initialDir = await client.pwd();
		console.log('Diretório inicial FTP:', initialDir);
		
		// Criar diretórios passo a passo
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			try {
				await client.cd(part);
				console.log(`Diretório ${part} já existe`);
			} catch (e) {
				console.log(`Criando diretório ${part}`);
				await client.send('MKD ' + part);
				await client.cd(part);
			}
		}
		
		// Upload do ficheiro
		console.log(`Fazendo upload do ficheiro ${fileName}`);
		const stream = Readable.from(buffer);
		await client.uploadFrom(stream, fileName);
		console.log(`Upload concluído: ${fileName}`);

		// Voltar ao diretório inicial
		await client.cd(initialDir);

		// URL pública (assume que publicHtmlPath aponta para o webroot do domínio)
		const url = `${config.baseUrl.replace(/\/$/, '')}/${normalized}`;
		return url;
	} finally {
		client.close();
	}
}

// Função para apagar uma pasta e todo o seu conteúdo via FTP
export async function deleteDirectoryRecursive(remotePath: string): Promise<boolean> {
	const config = getAmenFtpConfig();
	const client = await connectClient(config);
	try {
		// Normalizar caminho
		const normalized = remotePath.replace(/^\/+/, '').replace(/\/+$/, '');
		console.log(`Tentando apagar diretório: ${normalized}`);
		
		// Guardar diretório inicial
		const initialDir = await client.pwd();
		console.log('Diretório inicial FTP:', initialDir);
		
		try {
			// Verificar se o diretório existe
			await client.cd(normalized);
			
			// Listar conteúdo
			const list = await client.list();
			console.log(`Conteúdo do diretório (${list.length} itens):`, list.map(i => i.name).join(', '));
			
			// Apagar ficheiros e subdiretórios
			for (const item of list) {
				if (item.type === 1) { // Ficheiro
					console.log(`Apagando ficheiro: ${item.name}`);
					await client.remove(item.name);
				} else if (item.type === 2) { // Diretório
					if (item.name !== '.' && item.name !== '..') {
						console.log(`Apagando subdiretório: ${item.name}`);
						// Recursivamente apagar subdiretórios
						await client.cd(item.name);
						const sublist = await client.list();
						for (const subitem of sublist) {
							if (subitem.type === 1) { // Ficheiro
								console.log(`Apagando ficheiro em subdiretório: ${subitem.name}`);
								await client.remove(subitem.name);
							}
						}
						await client.cdup(); // Voltar ao diretório pai
						await client.removeDir(item.name);
					}
				}
			}
			
			// Voltar ao diretório inicial
			await client.cd(initialDir);
			
			// Apagar o diretório principal
			console.log(`Apagando diretório principal: ${normalized}`);
			await client.removeDir(normalized);
			
			return true;
		} catch (e) {
			console.error(`Erro ao apagar diretório ${normalized}:`, e);
			return false;
		}
	} finally {
		client.close();
	}
}

// Função para apagar um ficheiro específico via FTP
export async function deleteFileFromFtp(remotePath: string): Promise<boolean> {
	const config = getAmenFtpConfig();
	const client = await connectClient(config);
	try {
		// Normalizar caminho
		const normalized = remotePath.replace(/^\/+/, '').replace(/\/+$/, '');
		console.log(`Tentando apagar ficheiro: ${normalized}`);
		
		// Guardar diretório inicial
		const initialDir = await client.pwd();
		console.log('Diretório inicial FTP:', initialDir);
		
		try {
			// Extrair diretório e nome do ficheiro
			const parts = normalized.split('/');
			const fileName = parts.pop() as string;
			const directory = parts.join('/');
			
			// Navegar para o diretório se necessário
			if (directory) {
				await client.cd(directory);
				console.log(`Navegado para diretório: ${directory}`);
			}
			
			// Verificar se o ficheiro existe
			const list = await client.list();
			const fileExists = list.some(item => item.name === fileName && item.type === 1);
			
			if (!fileExists) {
				console.log(`Ficheiro não encontrado: ${fileName}`);
				return false;
			}
			
			// Apagar o ficheiro
			console.log(`Apagando ficheiro: ${fileName}`);
			await client.remove(fileName);
			console.log(`Ficheiro apagado com sucesso: ${fileName}`);
			
			// Voltar ao diretório inicial
			await client.cd(initialDir);
			
			return true;
		} catch (e) {
			console.error(`Erro ao apagar ficheiro ${normalized}:`, e);
			return false;
		}
	} finally {
		client.close();
	}
}

// Interface para o upload em chunks
// Removidos: tipos e funções de upload por chunks – usamos apenas upload direto