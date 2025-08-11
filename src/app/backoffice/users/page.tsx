'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  listUsers, 
  updateUser, 
  toggleUserActive, 
  changeUserPassword, 
  createUser,
  deleteUser,
  type User 
} from '../../../firebase/userServices';
import styles from '../backoffice.module.css';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  
  // Estados para modais
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Estados para criar utilizador
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'user' as 'user' | 'admin',
    description: '',
    active: true
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
  const router = useRouter();

  // Verificar autenticação e permissões
  useEffect(() => {
    const checkAuth = () => {
      const auth = localStorage.getItem('backofficeAuth');
      const userRole = localStorage.getItem('backofficeRole') as 'user' | 'admin';
      
      if (auth !== 'true') {
        router.push('/backoffice/login');
        return;
      }
      
      if (userRole !== 'admin') {
        router.push('/backoffice/dashboard');
        return;
      }
      
      setIsAuthenticated(true);

    };

    checkAuth();
  }, [router]);

  // Carregar utilizadores
  useEffect(() => {
    if (!isAuthenticated) return;
    
    loadUsers();
  }, [isAuthenticated]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersList = await listUsers();
      setUsers(usersList);
      setError(null);
    } catch (err) {
      console.error('Erro ao carregar utilizadores:', err);
      setError('Erro ao carregar utilizadores');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    if (!user.id) return;
    
    try {
      await toggleUserActive(user.id);
      await loadUsers(); // Recarregar lista
    } catch (err) {
      console.error('Erro ao alterar estado:', err);
      setError('Erro ao alterar estado do utilizador');
    }
  };

  const handlePasswordChange = async () => {
    if (!selectedUser?.id || !newPassword) return;
    
    if (newPassword !== confirmPassword) {
      setError('As passwords não coincidem');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('A password deve ter pelo menos 6 caracteres');
      return;
    }
    
    try {
      await changeUserPassword(selectedUser.id, newPassword);
      setShowPasswordModal(false);
      setSelectedUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      alert('Password alterada com sucesso!');
    } catch (err) {
      console.error('Erro ao alterar password:', err);
      setError('Erro ao alterar password');
    }
  };

  const handleUsernameChange = async () => {
    if (!selectedUser?.id || !newUsername) return;
    
    if (newUsername.length < 3) {
      setError('O nome de utilizador deve ter pelo menos 3 caracteres');
      return;
    }
    
    try {
      await updateUser(selectedUser.id, { username: newUsername });
      setShowUsernameModal(false);
      setSelectedUser(null);
      setNewUsername('');
      setError(null);
      await loadUsers();
      alert('Nome de utilizador alterado com sucesso!');
    } catch (err) {
      console.error('Erro ao alterar nome de utilizador:', err);
      setError(err instanceof Error ? err.message : 'Erro ao alterar nome de utilizador');
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.description) {
      setError('Todos os campos são obrigatórios');
      return;
    }
    
    if (newUser.password.length < 6) {
      setError('A password deve ter pelo menos 6 caracteres');
      return;
    }
    
    try {
      await createUser(newUser);
      setShowCreateModal(false);
      setNewUser({
        username: '',
        password: '',
        role: 'user',
        description: '',
        active: true
      });
      setError(null);
      await loadUsers();
      alert('Utilizador criado com sucesso!');
    } catch (err) {
      console.error('Erro ao criar utilizador:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar utilizador');
    }
  };

  const openPasswordModal = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordModal(true);
    setError(null);
  };

  const openCreateModal = () => {
    setNewUser({
      username: '',
      password: '',
      role: 'user',
      description: '',
      active: true
    });
    setShowCreatePassword(false);
    setShowCreateModal(true);
    setError(null);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete?.id) return;
    
    try {
      await deleteUser(userToDelete.id);
      setShowDeleteModal(false);
      setUserToDelete(null);
      setError(null);
      await loadUsers();
      alert('Utilizador eliminado com sucesso!');
    } catch (err) {
      console.error('Erro ao eliminar utilizador:', err);
      setError(err instanceof Error ? err.message : 'Erro ao eliminar utilizador');
    }
  };

  const openDeleteModal = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
    setError(null);
  };

  if (!isAuthenticated) {
    return <div className={styles.loading}>A verificar autenticação...</div>;
  }

  return (
    <div className={styles.backofficeContainer}>
      <header className={styles.backofficeHeader}>
        <h1>Gestão de Utilizadores</h1>
        <div className={styles.headerActions}>
          <button 
            className={styles.refreshButton}
            onClick={loadUsers}
            disabled={loading}
          >
            {loading ? 'A carregar...' : 'Atualizar'}
          </button>
          <button 
            className={styles.filterButton}
            onClick={openCreateModal}
          >
            Novo Utilizador
          </button>
          <button 
            className={styles.logoutButton}
            onClick={() => router.push('/backoffice/dashboard')}
          >
            Voltar
          </button>
        </div>
      </header>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.backofficeContent}>
        <div className={styles.mainContentArea}>
          <div style={{ flex: 1, backgroundColor: 'white', borderRadius: 8, padding: 20 }}>
            {loading ? (
              <div className={styles.loading}>A carregar utilizadores...</div>
            ) : (
              <div>
                <h2>Utilizadores Registados</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #eee' }}>
                      <th style={{ textAlign: 'left', padding: 12 }}>Username</th>
                      <th style={{ textAlign: 'left', padding: 12 }}>Tipo</th>
                      <th style={{ textAlign: 'left', padding: 12 }}>Descrição</th>
                      <th style={{ textAlign: 'center', padding: 12 }}>Estado</th>
                      <th style={{ textAlign: 'center', padding: 12 }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: 12, fontWeight: 600 }}>{user.username}</td>
                        <td style={{ padding: 12 }}>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: 4, 
                            fontSize: '0.8rem',
                            backgroundColor: user.role === 'admin' ? '#333' : '#666',
                            color: 'white'
                          }}>
                            {user.role === 'admin' ? 'Super Admin' : 'Utilizador'}
                          </span>
                        </td>
                        <td style={{ padding: 12 }}>{user.description}</td>
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: 4, 
                            fontSize: '0.8rem',
                            backgroundColor: user.active ? '#4CAF50' : '#f44336',
                            color: 'white'
                          }}>
                            {user.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td style={{ padding: 12, textAlign: 'center' }}>
                          <button 
                            className={styles.filterButton}
                            onClick={() => handleToggleActive(user)}
                            style={{ marginRight: 8, fontSize: '0.8rem' }}
                          >
                            {user.active ? 'Desativar' : 'Ativar'}
                          </button>
                          <button 
                            className={styles.filterButton}
                            onClick={() => { setSelectedUser(user); setNewUsername(user.username); setShowUsernameModal(true); setError(null);} }
                            style={{ marginRight: 8, fontSize: '0.8rem' }}
                          >
                            Alterar Username
                          </button>
                          <button 
                            className={styles.refreshButton}
                            onClick={() => openPasswordModal(user)}
                            style={{ marginRight: 8, fontSize: '0.8rem' }}
                          >
                            Alterar Password
                          </button>
                          <button 
                            className={styles.deleteAllButton}
                            onClick={() => openDeleteModal(user)}
                            style={{ fontSize: '0.8rem' }}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal para alterar password */}
      {showPasswordModal && selectedUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: 30,
            borderRadius: 8,
            width: 400,
            maxWidth: '90vw'
          }}>
            <h3>Alterar Password - {selectedUser.username}</h3>
            
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>
                Nova Password:
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 10px',
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    fontSize: 14
                  }}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    color: '#666'
                  }}
                >
                  {showNewPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>
                Confirmar Password:
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 10px',
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    fontSize: 14
                  }}
                  placeholder="Repetir password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    color: '#666'
                  }}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                className={styles.filterButton}
                onClick={() => setShowPasswordModal(false)}
              >
                Cancelar
              </button>
              <button 
                className={styles.refreshButton}
                onClick={handlePasswordChange}
                disabled={!newPassword || !confirmPassword}
              >
                Alterar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para alterar username */}
      {showUsernameModal && selectedUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: 30,
            borderRadius: 8,
            width: 420,
            maxWidth: '90vw'
          }}>
            <h3>Alterar Nome de Utilizador - {selectedUser.username}</h3>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>
                Novo Username:
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  fontSize: 14
                }}
                placeholder="Novo nome de utilizador"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                className={styles.filterButton}
                onClick={() => setShowUsernameModal(false)}
              >
                Cancelar
              </button>
              <button 
                className={styles.refreshButton}
                onClick={handleUsernameChange}
                disabled={!newUsername}
              >
                Alterar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para criar utilizador */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: 30,
            borderRadius: 8,
            width: 500,
            maxWidth: '90vw'
          }}>
            <h3>Criar Novo Utilizador</h3>
            
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>
                Username:
              </label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  fontSize: 14
                }}
                placeholder="Nome de utilizador único"
              />
            </div>

            <div style={{ marginBottom: 15 }}>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>
                Password:
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCreatePassword ? 'text' : 'password'}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 10px',
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    fontSize: 14
                  }}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    color: '#666'
                  }}
                >
                  {showCreatePassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 15 }}>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>
                Tipo:
              </label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'user' | 'admin' })}
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  fontSize: 14
                }}
              >
                <option value="user">Utilizador</option>
                <option value="admin">Super Admin</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>
                Descrição:
              </label>
              <input
                type="text"
                value={newUser.description}
                onChange={(e) => setNewUser({ ...newUser, description: e.target.value })}
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  fontSize: 14
                }}
                placeholder="Ex: Conta do Hotel XYZ"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                className={styles.filterButton}
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </button>
              <button 
                className={styles.refreshButton}
                onClick={handleCreateUser}
                disabled={!newUser.username || !newUser.password || !newUser.description}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para eliminar utilizador */}
      {showDeleteModal && userToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: 30,
            borderRadius: 8,
            width: 450,
            maxWidth: '90vw'
          }}>
            <h3 style={{ color: '#d9534f', marginTop: 0 }}>⚠️ Eliminar Utilizador</h3>
            
            <p style={{ marginBottom: 20, lineHeight: 1.6 }}>
              Tem a certeza que pretende eliminar o utilizador <strong>&quot;{userToDelete.username}&quot;</strong>?
              <br/><br/>
              <strong style={{ color: '#d9534f' }}>Esta ação é irreversível!</strong> 
              <br/>
              Todos os dados do utilizador serão permanentemente removidos da base de dados.
            </p>

            <div style={{ 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffeaa7',
              padding: 15,
              borderRadius: 4,
              marginBottom: 20
            }}>
              <strong>Dados que serão eliminados:</strong>
              <ul style={{ margin: '10px 0', paddingLeft: 20 }}>
                <li>Username: {userToDelete.username}</li>
                <li>Tipo: {userToDelete.role === 'admin' ? 'Super Admin' : 'Utilizador'}</li>
                <li>Descrição: {userToDelete.description}</li>
                <li>Password encriptada</li>
                <li>Todas as definições da conta</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                className={styles.filterButton}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancelar
              </button>
              <button 
                className={styles.deleteAllButton}
                onClick={handleDeleteUser}
                style={{ 
                  backgroundColor: '#d9534f',
                  border: '1px solid #d43f3a'
                }}
              >
                🗑️ Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}