// Importar as funções necessárias do SDK
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase para a página principal
// Esta é uma configuração completamente separada da configuração do Portugal dos Pequenitos
const mainFirebaseConfig = {
    apiKey: "AIzaSyACteZesFxDlU37wUjzupZ4YMwLXf1RWpM",
    authDomain: "virtualguide-83bc3.firebaseapp.com",
    projectId: "virtualguide-83bc3",
    storageBucket: "virtualguide-83bc3.firebasestorage.app",
    messagingSenderId: "652432670305",
    appId: "1:652432670305:web:c9d82e07ccfe345f69f420"
};

// Inicializar Firebase para a página principal
const mainApp = initializeApp(mainFirebaseConfig, 'main-app');

// Inicializar Firestore para a página principal
const mainDb = getFirestore(mainApp);

export { mainDb };
