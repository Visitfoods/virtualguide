import { mainDb } from '../firebase/mainConfig';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

// Script para migrar passwords existentes de texto plano para hash
export const migratePasswordsToHash = async (): Promise<void> => {
  try {
    console.log('🔄 Iniciando migração de passwords...');
    
    const usersSnapshot = await getDocs(collection(mainDb, 'users'));
    
    if (usersSnapshot.empty) {
      console.log('❌ Nenhum utilizador encontrado');
      return;
    }
    
    let migratedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const currentPassword = userData.password;
      
      // Verificar se a password já está em hash (bcrypt hashes começam com $2a$, $2b$, etc.)
      if (currentPassword && !currentPassword.startsWith('$2')) {
        console.log(`🔐 Migrando password do utilizador: ${userData.username}`);
        
        // Fazer hash da password atual
        const hashedPassword = await bcrypt.hash(currentPassword, 10);
        
        // Atualizar no Firebase
        await updateDoc(doc(mainDb, 'users', userDoc.id), {
          password: hashedPassword,
          updatedAt: new Date().toISOString()
        });
        
        migratedCount++;
        console.log(`✅ Password migrada para: ${userData.username}`);
      } else {
        console.log(`⏭️  Password já está em hash: ${userData.username}`);
      }
    }
    
    console.log(`\n🎉 Migração concluída! ${migratedCount} passwords foram migradas.`);
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    throw error;
  }
};