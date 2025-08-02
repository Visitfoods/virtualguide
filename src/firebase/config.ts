// Importar as funções necessárias do SDK
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase usando variáveis de ambiente
// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBtQss14HXKtRuyEG4G9HUAQYq5I5N5hf0",
    authDomain: "virtualguide-ebf86.firebaseapp.com",
    projectId: "virtualguide-ebf86",
    storageBucket: "virtualguide-ebf86.firebasestorage.app",
    messagingSenderId: "616147587566",
    appId: "1:616147587566:web:74bf6cc1583cbe4ed57eff"
  };
  

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore
const db = getFirestore(app);

export { db }; 