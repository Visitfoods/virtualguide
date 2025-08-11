import { mainDb } from './mainConfig';
import { collection, addDoc, getDocs, doc, updateDoc, getDoc, query, where, deleteDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

// Interface para utilizadores
export interface User {
  id?: string;
  username: string;
  password: string;
  role: 'user' | 'admin';
  active: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// Listar todos os utilizadores
export const listUsers = async (): Promise<User[]> => {
  try {
    const querySnapshot = await getDocs(collection(mainDb, 'users'));
    const users: User[] = [];
    
    querySnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      } as User);
    });
    
    // Ordenar por role (admin primeiro) e depois por username
    users.sort((a, b) => {
      if (a.role === b.role) {
        return a.username.localeCompare(b.username);
      }
      return a.role === 'admin' ? -1 : 1;
    });
    
    return users;
  } catch (error) {
    console.error('Erro ao listar utilizadores:', error);
    throw error;
  }
};

// Validar credenciais de login
export const validateCredentials = async (username: string, password: string): Promise<User | null> => {
  try {
    // Buscar utilizador apenas por username e ativo
    const q = query(
      collection(mainDb, 'users'),
      where('username', '==', username),
      where('active', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as User;
    
    // Verificar password com bcrypt
    const passwordMatch = await bcrypt.compare(password, userData.password);
    
    if (!passwordMatch) {
      return null;
    }
    
    return {
      id: userDoc.id,
      ...userData
    } as User;
  } catch (error) {
    console.error('Erro ao validar credenciais:', error);
    throw error;
  }
};

// Criar novo utilizador
export const createUser = async (userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    // Verificar se o username já existe
    const q = query(collection(mainDb, 'users'), where('username', '==', userData.username));
    const existingUser = await getDocs(q);
    
    if (!existingUser.empty) {
      throw new Error('Nome de utilizador já existe');
    }
    
    // Hash da password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const userWithTimestamps = {
      ...userData,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(mainDb, 'users'), userWithTimestamps);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar utilizador:', error);
    throw error;
  }
};

// Atualizar utilizador
export const updateUser = async (userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void> => {
  try {
    const userRef = doc(mainDb, 'users', userId);
    
    // Se estiver a atualizar o username, verificar se já existe
    if (updates.username) {
      const q = query(collection(mainDb, 'users'), where('username', '==', updates.username));
      const existingUser = await getDocs(q);
      
      // Verificar se existe e não é o próprio utilizador
      if (!existingUser.empty && existingUser.docs[0].id !== userId) {
        throw new Error('Nome de utilizador já existe');
      }
    }
    
    const updateData = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await updateDoc(userRef, updateData);
  } catch (error) {
    console.error('Erro ao atualizar utilizador:', error);
    throw error;
  }
};

// Obter utilizador por ID
export const getUser = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(mainDb, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    return {
      id: userDoc.id,
      ...userDoc.data()
    } as User;
  } catch (error) {
    console.error('Erro ao obter utilizador:', error);
    throw error;
  }
};

// Alternar estado ativo/inativo do utilizador
export const toggleUserActive = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(mainDb, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('Utilizador não encontrado');
    }
    
    const currentData = userDoc.data() as User;
    await updateDoc(userRef, {
      active: !currentData.active,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao alternar estado do utilizador:', error);
    throw error;
  }
};

// Alterar password do utilizador
export const changeUserPassword = async (userId: string, newPassword: string): Promise<void> => {
  try {
    // Hash da nova password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const userRef = doc(mainDb, 'users', userId);
    await updateDoc(userRef, {
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao alterar password:', error);
    throw error;
  }
};

// Eliminar utilizador
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(mainDb, 'users', userId);
    
    // Verificar se o utilizador existe antes de eliminar
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      throw new Error('Utilizador não encontrado');
    }
    
    await deleteDoc(userRef);
    console.log('Utilizador eliminado com sucesso:', userId);
  } catch (error) {
    console.error('Erro ao eliminar utilizador:', error);
    throw error;
  }
};

// Função para criar utilizadores iniciais (executar uma vez)
export const seedInitialUsers = async (): Promise<void> => {
  try {
    const existingUsers = await getDocs(collection(mainDb, 'users'));
    
    // Só criar se não existirem utilizadores
    if (existingUsers.empty) {
      const initialUsers = [
        {
          username: 'admin',
          password: await bcrypt.hash('guiareal123', 10),
          role: 'user' as const,
          active: true,
          description: 'Conta do Portugal dos Pequenitos',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          username: 'superadmin',
          password: await bcrypt.hash('superadmin123', 10),
          role: 'admin' as const,
          active: true,
          description: 'Conta de Super Administrador',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      for (const user of initialUsers) {
        await addDoc(collection(mainDb, 'users'), user);
      }
      
      console.log('Utilizadores iniciais criados com sucesso');
    }
  } catch (error) {
    console.error('Erro ao criar utilizadores iniciais:', error);
    throw error;
  }
};