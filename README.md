REGRAS DO FIRE BASE

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Regra para a coleção de usuários
    match /usuarios/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Regra para a coleção de ADIs (STF)
    match /adis/{document=**} {
      allow read: if true; // Qualquer um pode ler no site
      allow write: if request.auth != null; // Apenas pesquisadores logados podem publicar
    }

    // NOVA REGRA: Coleção do Congresso Nacional (PLs, PECs, etc)
    match /congresso/{document=**} {
      allow read: if true; // Qualquer um pode ver no site
      allow write: if request.auth != null; // Apenas pesquisadores logados podem publicar
    }

    //NOVA REGRA: histórico de atividades
    match /logs_atividades/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
