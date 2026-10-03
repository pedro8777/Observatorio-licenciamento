// Importando as funções do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, getDocs, collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, updateDoc, deleteDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA7PVJfKxZox5sTxwI-25aXMded62etZv0",
  authDomain: "observatorio-8ffa6.firebaseapp.com",
  projectId: "observatorio-8ffa6",
  storageBucket: "observatorio-8ffa6.firebasestorage.app",
  messagingSenderId: "743852913632",
  appId: "1:743852913632:web:3152c92fae88a5a7df7185",
  measurementId: "G-HG1J2MNY7X"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {
    let currentUserEmail = null;
    let graficoRequerentesInstance = null;
    let graficoAmicusTipoInstance = null;
    let graficoAmicusPosInstance = null;

    // Elementos de Navegação e Perfil
    const navLoginBtn = document.getElementById("nav-login-btn");
    const navUserMenu = document.getElementById("nav-user-menu");
    const btnLogout = document.getElementById("btn-logout");
    const formAuth = document.getElementById("form-auth");
    const modal = document.getElementById("login-modal");
    const formPerfil = document.getElementById("form-perfil");
    const avatarPreview = document.getElementById("avatar-preview");
    
    const areaBotoesCadastros = document.getElementById("area-botoes-cadastros");
    const areaBotaoAdi = document.getElementById("area-botao-adi"); 
    
    // Elementos de Confirmação de Senha e Compartilhamento
    const passwordModal = document.getElementById("password-confirm-modal");
    const fecharPasswordModal = document.getElementById("fechar-password-modal");
    const btnCancelPassword = document.getElementById("btn-cancel-password");
    const formPasswordConfirm = document.getElementById("form-password-confirm");
    let acaoPendente = null; 

    const shareModal = document.getElementById("share-modal");
    const fecharShareModal = document.getElementById("fechar-share-modal");
    const btnAddShare = document.getElementById("btn-add-share");
    const shareEmailInput = document.getElementById("share-email-input");
    const shareList = document.getElementById("share-list");
    let currentShareAdiId = null;

    // Função central para registrar atividades
    async function registrarLogAtividade(tipoAcao, entidade, descricao, identificador) {
        const user = auth.currentUser;
        if (!user) return;
        try {
            let nomeUsuario = user.email;
            const userSnap = await getDoc(doc(db, "usuarios", user.uid));
            if (userSnap.exists() && userSnap.data().nome) nomeUsuario = userSnap.data().nome;

            await addDoc(collection(db, "logs_atividades"), {
                usuarioEmail: user.email,
                usuarioNome: nomeUsuario,
                tipoAcao: tipoAcao, 
                entidade: entidade,
                identificador: identificador || "",
                descricao: descricao,
                dataRegistroISO: new Date().toISOString(),
                dataHora: serverTimestamp()
            });
        } catch (error) { console.error("Falha ao registrar log:", error); }
    }

    // Pede a senha, autentica e executa a função bloqueada (À prova de falhas se o HTML não existir)
    function pedirSenhaEExecutar(callback) {
        acaoPendente = callback;
        const pwInput = document.getElementById("confirm-password-input");
        if (pwInput) pwInput.value = "";
        
        if (passwordModal) {
            passwordModal.classList.remove("hidden");
        } else {
            // Se o modal de senha não existir no HTML, executa a ação diretamente
            callback();
            acaoPendente = null;
        }
    }

    if (formPasswordConfirm) {
        formPasswordConfirm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!acaoPendente) return;
            
            const pwInput = document.getElementById("confirm-password-input").value;
            const btnConfirm = document.getElementById("btn-confirm-password");
            btnConfirm.textContent = "Verificando...";
            btnConfirm.disabled = true;

            const user = auth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, pwInput);

            try {
                await reauthenticateWithCredential(user, credential);
                if (passwordModal) passwordModal.classList.add("hidden");
                await acaoPendente(); 
                acaoPendente = null;
            } catch (err) {
                console.error(err);
                alert("Senha incorreta. Ação bloqueada por segurança.");
            } finally {
                btnConfirm.textContent = "Confirmar e Salvar";
                btnConfirm.disabled = false;
            }
        });
    }

    // Função para renderizar lista de compartilhamento
    function renderShareList(editores, adiId) {
        if (!shareList) return;
        shareList.innerHTML = "";
        if (!editores || editores.length === 0) {
            shareList.innerHTML = "<li class='share-empty'>Nenhum colaborador adicionado.</li>";
            return;
        }
        editores.forEach(email => {
            const li = document.createElement("li");
            li.className = "share-list-item";
            li.innerHTML = `
                <span><i class="ph ph-user"></i> ${email}</span>
                <button type="button" class="btn-remove-share" title="Remover Acesso" data-email="${email}"><i class="ph ph-trash"></i></button>
            `;
            shareList.appendChild(li);
        });

        shareList.querySelectorAll(".btn-remove-share").forEach(btn => {
            btn.addEventListener("click", async () => {
                const emailToRemove = btn.getAttribute("data-email");
                if (confirm(`Tem certeza que deseja remover o acesso de ${emailToRemove}?`)) {
                    try {
                        await updateDoc(doc(db, "adis", adiId), {
                            editoresPermitidos: arrayRemove(emailToRemove)
                        });
                        btn.closest("li").remove();
                        if (shareList.children.length === 0) shareList.innerHTML = "<li class='share-empty'>Nenhum colaborador adicionado.</li>";
                    } catch (e) {
                        alert("Erro ao remover colaborador.");
                    }
                }
            });
        });
    }

    if (btnAddShare) {
        btnAddShare.addEventListener("click", async () => {
            const email = shareEmailInput.value.trim().toLowerCase();
            if (!email) return;

            const btnOriginalText = btnAddShare.textContent;
            btnAddShare.textContent = "Verificando...";
            btnAddShare.disabled = true;

            try {
                const q = query(collection(db, "usuarios"), where("email", "==", email));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    alert(`Atenção: O e-mail ${email} não está cadastrado na plataforma. O usuário precisa criar uma conta primeiro.`);
                } else {
                    await updateDoc(doc(db, "adis", currentShareAdiId), {
                        editoresPermitidos: arrayUnion(email)
                    });
                    shareEmailInput.value = "";
                    const snap = await getDoc(doc(db, "adis", currentShareAdiId));
                    if (snap.exists()) renderShareList(snap.data().editoresPermitidos || [], currentShareAdiId);
                }
            } catch (e) {
                console.error(e);
                alert("Erro ao verificar ou adicionar colaborador.");
            } finally {
                btnAddShare.textContent = btnOriginalText;
                btnAddShare.disabled = false;
            }
        });
    }

    // Elementos STF (ADI)
    const formAdi = document.getElementById("form-adi");
    const stfGrid = document.getElementById("stf-grid");
    const modalAdi = document.getElementById("adi-modal");
    const fecharAdi = document.getElementById("fechar-adi");
    const btnAbrirFormAdi = document.getElementById("btn-abrir-form-adi");
    const containerFormAdi = document.getElementById("container-form-adi");
    const fecharFormAdi = document.getElementById("fechar-form-adi");
    const historicoAdiGrid = document.getElementById("historico-adi-grid");

    const proponentesContainer = document.getElementById("proponentes-container");
    const btnAddProponente = document.getElementById("btn-add-proponente");
    const amicusContainer = document.getElementById("amicus-container");
    const btnAddAmicus = document.getElementById("btn-add-amicus");
    const dispositivosContainer = document.getElementById("dispositivos-container");
    const btnAddDispositivo = document.getElementById("btn-add-dispositivo");
    const principiosContainer = document.getElementById("principios-container");
    const btnAddPrincipio = document.getElementById("btn-add-principio");
    const doutrinasContainer = document.getElementById("doutrinas-container");
    const btnAddDoutrina = document.getElementById("btn-add-doutrina");
    const constitucionaisContainer = document.getElementById("constitucionais-container");
    const btnAddConstitucional = document.getElementById("btn-add-constitucional");

    const modalMovimento = document.getElementById("movimento-modal");
    const fecharMovimento = document.getElementById("fechar-movimento");
    const formMovimento = document.getElementById("form-movimento");
    let idParaMovimentacao = null; 
    let colecaoMovimentacao = null; 

    let unsubscribeHistorico = null;
    let unsubscribeHistoricoCong = null; 

    const btnAbrirFormCongresso = document.getElementById("btn-abrir-form-congresso");
    const containerFormCongresso = document.getElementById("container-form-congresso");
    const fecharFormCongresso = document.getElementById("fechar-form-congresso");
    const formCongresso = document.getElementById("form-congresso");
    const congressoGrid = document.getElementById("congresso-grid");
    const modalCongresso = document.getElementById("congresso-modal");
    const fecharCongresso = document.getElementById("fechar-congresso");
    const historicoCongressoGrid = document.getElementById("historico-congresso-grid"); 
    
    const normasCongContainer = document.getElementById("normas-cong-container");
    const btnAddNormaCong = document.getElementById("btn-add-norma-cong");
    const atoresCongContainer = document.getElementById("atores-cong-container");
    const btnAddAtorCong = document.getElementById("btn-add-ator-cong");
    const trechosLeiContainer = document.getElementById("trechos-lei-container");
    const btnAddTrechoLei = document.getElementById("btn-add-trecho-lei"); 

    // ==========================================
    // FUNÇÕES DINÂMICAS: FORMULÁRIOS STF E CONGRESSO
    // ==========================================
    function criarLinhaProponente(nome = "", tipo = "") {
        if (!proponentesContainer) return;
        const row = document.createElement("div");
        row.className = "proponente-row";
        row.style = "display: flex; gap: 15px; margin-bottom: 12px; align-items: flex-end; width: 100%; flex-wrap: wrap;";
        const isExtra = proponentesContainer.children.length > 0;

        row.innerHTML = `
            <div class="form-group" style="flex: 3; min-width: 200px; margin-bottom: 0;">
                <label style="${isExtra ? 'display:none;' : ''}">Quem propôs a ação (Autor)</label>
                <input type="text" class="prop-nome" placeholder="Ex: Procurador-Geral da República" value="${nome}" required style="width:100%;">
            </div>
            <div class="form-group" style="flex: 3; min-width: 200px; margin-bottom: 0;">
                <label style="${isExtra ? 'display:none;' : ''}">Tipo de Legitimado</label>
                <select class="prop-tipo" required style="width:100%;">
                    <option value="" disabled ${!tipo ? 'selected' : ''}>Selecione o tipo...</option>
                    <option value="Presidente da República" ${tipo === 'Presidente da República' ? 'selected' : ''}>Presidente da República</option>
                    <option value="Mesa do Senado Federal" ${tipo === 'Mesa do Senado Federal' ? 'selected' : ''}>Mesa do Senado Federal</option>
                    <option value="Mesa da Câmara dos Deputados" ${tipo === 'Mesa da Câmara dos Deputados' ? 'selected' : ''}>Mesa da Câmara dos Deputados</option>
                    <option value="Mesa de Assembleia Legislativa ou da Câmara Legislativa do Distrito Federal" ${tipo === 'Mesa de Assembleia Legislativa ou da Câmara Legislativa do Distrito Federal' ? 'selected' : ''}>Mesa de Assembleia ou Câmara do DF</option>
                    <option value="Governador de Estado ou do Distrito Federal" ${tipo === 'Governador de Estado ou do Distrito Federal' ? 'selected' : ''}>Governador de Estado ou do DF</option>
                    <option value="Procurador-Geral da República" ${tipo === 'Procurador-Geral da República' ? 'selected' : ''}>Procurador-Geral da República</option>
                    <option value="Conselho Federal da Ordem dos Advogados do Brasil (OAB)" ${tipo === 'Conselho Federal da Ordem dos Advogados do Brasil (OAB)' ? 'selected' : ''}>Conselho Federal da OAB</option>
                    <option value="partido político com representação" ${tipo === 'partido político com representação' ? 'selected' : ''}>Partido político</option>
                    <option value="confederação sindical ou entidade de classe de âmbito nacional" ${tipo === 'confederação sindical ou entidade de classe de âmbito nacional' ? 'selected' : ''}>Confederação sindical / entidade de classe</option>
                    <option value="terceiro sector" ${tipo === 'terceiro sector' ? 'selected' : ''}>Terceiro setor</option>
                </select>
            </div>
            ${isExtra ? `<button type="button" class="btn-action-delete btn-remove-prop" style="padding: 11px 14px; margin-bottom: 0;"><i class="ph ph-trash"></i></button>` : `<div style="width: 44px;"></div>`}
        `;
        if (isExtra) row.querySelector(".btn-remove-prop").addEventListener("click", () => row.remove());
        proponentesContainer.appendChild(row);
    }

    function criarLinhaAmicus(nome = "", tipo = "", pos = "") {
        if (!amicusContainer) return;
        const row = document.createElement("div");
        row.className = "amicus-row";
        row.style = "display: flex; gap: 10px; margin-bottom: 12px; align-items: flex-end; width: 100%; flex-wrap: wrap;";
        const isExtra = amicusContainer.children.length > 0;

        row.innerHTML = `
            <div class="form-group" style="flex: 2; min-width: 180px; margin-bottom: 0;">
                <label style="${isExtra ? 'display:none;' : ''}">Nome da Entidade</label>
                <input type="text" class="ami-nome" placeholder="Ex: Instituto Socioambiental" value="${nome}" style="width:100%;">
            </div>
            <div class="form-group" style="flex: 2; min-width: 180px; margin-bottom: 0;">
                <label style="${isExtra ? 'display:none;' : ''}">Categoria</label>
                <select class="ami-tipo" style="width:100%;">
                    <option value="" disabled ${!tipo ? 'selected' : ''}>Selecione...</option>
                    <option value="Entidades de Classe" ${tipo === 'Entidades de Classe' ? 'selected' : ''}>Entidades de Classe</option>
                    <option value="Associações Profissionais" ${tipo === 'Associações Profissionais' ? 'selected' : ''}>Associações Profissionais</option>
                    <option value="Terceiro Setor" ${tipo === 'Terceiro Setor' ? 'selected' : ''}>Terceiro Setor</option>
                    <option value="Institutos de Defesa de Direitos" ${tipo === 'Institutos de Defesa de Direitos' ? 'selected' : ''}>Institutos de Defesa de Direitos</option>
                    <option value="Conselhos de Fiscalização Profissional" ${tipo === 'Conselhos de Fiscalização Profissional' ? 'selected' : ''}>Conselhos de Fiscalização</option>
                    <option value="Instituições de Ensino, Pesquisa e Academia" ${tipo === 'Instituições de Ensino, Pesquisa e Academia' ? 'selected' : ''}>Ensino e Pesquisa</option>
                    <option value="Órgãos Públicos e Entidades Estatais" ${tipo === 'Órgãos Públicos e Entidades Estatais' ? 'selected' : ''}>Órgãos Públicos e Entidades Estatais</option>
                </select>
            </div>
            <div class="form-group" style="flex: 1.5; min-width: 150px; margin-bottom: 0;">
                <label style="${isExtra ? 'display:none;' : ''}">Posicionamento</label>
                <select class="ami-pos" style="width:100%;">
                    <option value="" disabled ${!pos ? 'selected' : ''}>Selecione...</option>
                    <option value="A favor da inconstitucionalidade" ${pos === 'A favor da inconstitucionalidade' ? 'selected' : ''}>A favor da inconstitucional.</option>
                    <option value="Contra a inconstitucionalidade" ${pos === 'Contra a inconstitucionalidade' ? 'selected' : ''}>Contra a inconstitucional.</option>
                    <option value="Neutro" ${pos === 'Neutro' ? 'selected' : ''}>Neutro</option>
                </select>
            </div>
            <button type="button" class="btn-action-delete btn-remove-ami" style="padding: 11px 14px; margin-bottom: 0;"><i class="ph ph-trash"></i></button>
        `;
        row.querySelector(".btn-remove-ami").addEventListener("click", () => row.remove());
        amicusContainer.appendChild(row);
    }

    function criarLinhaDispositivo(texto = "", justificativa = "", status = "") {
        if (!dispositivosContainer) return;
        const row = document.createElement("div");
        row.className = "dispositivo-row";
        row.style = "display: flex; gap: 10px; margin-bottom: 12px; align-items: flex-start; width: 100%; flex-wrap: wrap; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;";
        const isExtra = dispositivosContainer.children.length > 0;

        row.innerHTML = `
            <div class="form-group" style="flex: 100%; margin-bottom: 10px;">
                <label>Texto do Dispositivo Questionado</label>
                <textarea class="disp-texto" rows="2" placeholder="Ex: Art. 2º, § 3º da Lei XYZ..." required style="width:100%;">${texto}</textarea>
            </div>
            <div class="form-group" style="flex: 2; min-width: 200px; margin-bottom: 0;">
                <label>Justificativa da Inicial</label>
                <textarea class="disp-justificativa" rows="2" placeholder="Ex: Viola o princípio da precaução..." required style="width:100%;">${justificativa}</textarea>
            </div>
            <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0;">
                <label>Status no STF</label>
                <select class="disp-status" required style="width:100%;">
                    <option value="" disabled ${!status ? 'selected' : ''}>Selecione...</option>
                    <option value="Pendente de Julgamento" ${status === 'Pendente de Julgamento' ? 'selected' : ''}>Pendente de Julgamento</option>
                    <option value="Constitucional" ${status === 'Constitucional' ? 'selected' : ''}>Constitucional (Válido)</option>
                    <option value="Inconstitucional" ${status === 'Inconstitucional' ? 'selected' : ''}>Inconstitucional (Inválido)</option>
                    <option value="Interpretação Conforme" ${status === 'Interpretação Conforme' ? 'selected' : ''}>Interpretação Conforme</option>
                </select>
            </div>
            ${isExtra ? `<button type="button" class="btn-action-delete btn-remove-disp" style="padding: 11px 14px; margin-bottom: 0; align-self: flex-end;"><i class="ph ph-trash"></i></button>` : `<div style="width: 44px;"></div>`}
        `;
        if (isExtra) row.querySelector(".btn-remove-disp").addEventListener("click", () => row.remove());
        dispositivosContainer.appendChild(row);
    }

    function criarLinhaPrincipio(nome = "", aplicacao = "", ator = "", documento = "") {
        if (!principiosContainer) return;
        const row = document.createElement("div");
        row.className = "principio-row";
        row.style = "display: flex; gap: 10px; margin-bottom: 12px; align-items: flex-start; width: 100%; flex-wrap: wrap; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;";
        const isExtra = principiosContainer.children.length > 0;

        row.innerHTML = `
            <div class="form-group" style="flex: 100%; margin-bottom: 10px;">
                <label>Nome do Princípio</label>
                <input type="text" class="prin-nome" placeholder="Ex: Princípio da Precaução..." value="${nome}" required style="width:100%;">
            </div>
            <div class="form-group" style="flex: 2; min-width: 150px; margin-bottom: 0;">
                <label>Aplicação / Contexto</label>
                <textarea class="prin-aplicacao" rows="2" placeholder="Ex: Invocado para justificar a inconstitucionalidade da norma..." required style="width:100%;">${aplicacao}</textarea>
            </div>
            <div class="form-group" style="flex: 1.5; min-width: 150px; margin-bottom: 0;">
                <label>Invocado por (Ator)</label>
                <input type="text" class="prin-ator" placeholder="Ex: PGR / Partido X" value="${ator}" required style="width:100%;">
            </div>
            <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0;">
                <label>Peça Processual</label>
                <select class="prin-documento" required style="width:100%;">
                    <option value="" disabled ${!documento ? 'selected' : ''}>Selecione...</option>
                    <option value="Petição Inicial" ${documento === 'Petição Inicial' ? 'selected' : ''}>Petição Inicial</option>
                    <option value="Manifestação AGU" ${documento === 'Manifestação AGU' ? 'selected' : ''}>Manifestação AGU</option>
                    <option value="Parecer PGR" ${documento === 'Parecer PGR' ? 'selected' : ''}>Parecer PGR</option>
                    <option value="Amicus Curiae" ${documento === 'Amicus Curiae' ? 'selected' : ''}>Manifestação Amicus Curiae</option>
                    <option value="Voto Relator(a)" ${documento === 'Voto Relator(a)' ? 'selected' : ''}>Voto do(a) Relator(a)</option>
                    <option value="Voto Divergente" ${documento === 'Voto Divergente' ? 'selected' : ''}>Voto Divergente</option>
                    <option value="Acórdão" ${documento === 'Acórdão' ? 'selected' : ''}>Acórdão Final</option>
                </select>
            </div>
            ${isExtra ? `<button type="button" class="btn-action-delete btn-remove-prin" style="padding: 11px 14px; margin-bottom: 0; align-self: flex-end;"><i class="ph ph-trash"></i></button>` : `<div style="width: 44px;"></div>`}
        `;
        if (isExtra) row.querySelector(".btn-remove-prin").addEventListener("click", () => row.remove());
        principiosContainer.appendChild(row);
    }

    function criarLinhaDoutrina(conceito = "", autor = "", obra = "", documento = "") {
        if (!doutrinasContainer) return;
        const row = document.createElement("div");
        row.className = "doutrina-row";
        row.style = "display: flex; gap: 10px; margin-bottom: 12px; align-items: flex-start; width: 100%; flex-wrap: wrap; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;";
        const isExtra = doutrinasContainer.children.length > 0;

        row.innerHTML = `
            <div class="form-group" style="flex: 100%; margin-bottom: 10px;">
                <label>Conceito / Tese Doutrinária</label>
                <textarea class="dou-conceito" rows="2" placeholder="Ex: Princípio da Vedação ao Retrocesso Ambiental (Tese do Autor)..." required style="width:100%;">${conceito}</textarea>
            </div>
            <div class="form-group" style="flex: 1.5; min-width: 150px; margin-bottom: 0;">
                <label>Doutrinador(a)</label>
                <input type="text" class="dou-autor" placeholder="Ex: Ingo Sarlet" value="${autor}" required style="width:100%;">
            </div>
            <div class="form-group" style="flex: 2; min-width: 150px; margin-bottom: 0;">
                <label>Obra / Artigo</label>
                <input type="text" class="dou-obra" placeholder="Ex: A Eficácia dos Direitos Fundamentais" value="${obra}" required style="width:100%;">
            </div>
            <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0;">
                <label>Usado em qual Peça?</label>
                <select class="dou-documento" required style="width:100%;">
                    <option value="" disabled ${!documento ? 'selected' : ''}>Selecione...</option>
                    <option value="Petição Inicial" ${documento === 'Petição Inicial' ? 'selected' : ''}>Petição Inicial</option>
                    <option value="Manifestação AGU" ${documento === 'Manifestação AGU' ? 'selected' : ''}>Manifestação AGU</option>
                    <option value="Parecer PGR" ${documento === 'Parecer PGR' ? 'selected' : ''}>Parecer PGR</option>
                    <option value="Amicus Curiae" ${documento === 'Amicus Curiae' ? 'selected' : ''}>Manifestação Amicus Curiae</option>
                    <option value="Voto Relator(a)" ${documento === 'Voto Relator(a)' ? 'selected' : ''}>Voto do(a) Relator(a)</option>
                    <option value="Voto Divergente" ${documento === 'Voto Divergente' ? 'selected' : ''}>Voto Divergente</option>
                    <option value="Acórdão" ${documento === 'Acórdão' ? 'selected' : ''}>Acórdão Final</option>
                </select>
            </div>
            ${isExtra ? `<button type="button" class="btn-action-delete btn-remove-dou" style="padding: 11px 14px; margin-bottom: 0; align-self: flex-end;"><i class="ph ph-trash"></i></button>` : `<div style="width: 44px;"></div>`}
        `;
        if (isExtra) row.querySelector(".btn-remove-dou").addEventListener("click", () => row.remove());
        doutrinasContainer.appendChild(row);
    }

    function criarLinhaConstitucional(dispositivo = "", fundamento = "", ator = "", documento = "") {
        if (!constitucionaisContainer) return;
        const row = document.createElement("div");
        row.className = "constitucional-row";
        row.style = "display: flex; gap: 10px; margin-bottom: 12px; align-items: flex-start; width: 100%; flex-wrap: wrap; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;";
        const isExtra = constitucionaisContainer.children.length > 0;

        row.innerHTML = `
            <div class="form-group" style="flex: 100%; margin-bottom: 10px;">
                <label>Dispositivo da Constituição Federal</label>
                <input type="text" class="const-dispositivo" placeholder="Ex: Art. 225, caput, CF/88" value="${dispositivo}" required style="width:100%;">
            </div>
            <div class="form-group" style="flex: 2; min-width: 150px; margin-bottom: 0;">
                <label>Fundamento / Aplicação</label>
                <textarea class="const-fundamento" rows="2" placeholder="Ex: Direito ao meio ambiente ecologicamente equilibrado, invocado para sustentar a inconstitucionalidade..." required style="width:100%;">${fundamento}</textarea>
            </div>
            <div class="form-group" style="flex: 1.5; min-width: 150px; margin-bottom: 0;">
                <label>Invocado por (Ator)</label>
                <input type="text" class="const-ator" placeholder="Ex: PGR / Partido X" value="${ator}" required style="width:100%;">
            </div>
            <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0;">
                <label>Peça Processual</label>
                <select class="const-documento" required style="width:100%;">
                    <option value="" disabled ${!documento ? 'selected' : ''}>Selecione...</option>
                    <option value="Petição Inicial" ${documento === 'Petição Inicial' ? 'selected' : ''}>Petição Inicial</option>
                    <option value="Manifestação AGU" ${documento === 'Manifestação AGU' ? 'selected' : ''}>Manifestação AGU</option>
                    <option value="Parecer PGR" ${documento === 'Parecer PGR' ? 'selected' : ''}>Parecer PGR</option>
                    <option value="Amicus Curiae" ${documento === 'Amicus Curiae' ? 'selected' : ''}>Manifestação Amicus Curiae</option>
                    <option value="Voto Relator(a)" ${documento === 'Voto Relator(a)' ? 'selected' : ''}>Voto do(a) Relator(a)</option>
                    <option value="Voto Divergente" ${documento === 'Voto Divergente' ? 'selected' : ''}>Voto Divergente</option>
                    <option value="Acórdão" ${documento === 'Acórdão' ? 'selected' : ''}>Acórdão Final</option>
                </select>
            </div>
            ${isExtra ? `<button type="button" class="btn-action-delete btn-remove-const" style="padding: 11px 14px; margin-bottom: 0; align-self: flex-end;"><i class="ph ph-trash"></i></button>` : `<div style="width: 44px;"></div>`}
        `;
        if (isExtra) row.querySelector(".btn-remove-const").addEventListener("click", () => row.remove());
        constitucionaisContainer.appendChild(row);
    }

    function criarLinhaNormaCong(norma = "", impacto = "") {
        if (!normasCongContainer) return;
        const row = document.createElement("div");
        row.className = "norma-cong-row";
        row.style = "display: flex; gap: 10px; margin-bottom: 12px; align-items: flex-start; width: 100%; flex-wrap: wrap;";
        const isExtra = normasCongContainer.children.length > 0;

        row.innerHTML = `
            <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0;">
                <label style="${isExtra ? 'display:none;' : ''}">Lei / Norma Afetada</label>
                <input type="text" class="cong-norma-nome" placeholder="Ex: Lei 6.938/81" value="${norma}" required style="width:100%;">
            </div>
            <div class="form-group" style="flex: 2; min-width: 200px; margin-bottom: 0;">
                <label style="${isExtra ? 'display:none;' : ''}">Como é afetada?</label>
                <input type="text" class="cong-norma-impacto" placeholder="Ex: Revoga os artigos X e Y..." value="${impacto}" required style="width:100%;">
            </div>
            ${isExtra ? `<button type="button" class="btn-action-delete btn-remove-norma" style="padding: 11px 14px; margin-bottom: 0;"><i class="ph ph-trash"></i></button>` : `<div style="width: 44px;"></div>`}
        `;
        if (isExtra) row.querySelector(".btn-remove-norma").addEventListener("click", () => row.remove());
        normasCongContainer.appendChild(row);
    }

    function criarLinhaAtorCong(nome = "", posicao = "", nota = "") {
        if (!atoresCongContainer) return;
        const row = document.createElement("div");
        row.className = "ator-cong-row";
        row.style = "display: flex; gap: 10px; margin-bottom: 12px; align-items: flex-start; width: 100%; flex-wrap: wrap; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;";
        const isExtra = atoresCongContainer.children.length > 0;

        row.innerHTML = `
            <div class="form-group" style="flex: 2; min-width: 180px; margin-bottom: 10px;">
                <label>Instituição / Frente Parlamentar</label>
                <input type="text" class="cong-ator-nome" placeholder="Ex: Frente da Agropecuária ou Observatório do Clima" value="${nome}" required style="width:100%;">
            </div>
            <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 10px;">
                <label>Posicionamento</label>
                <select class="cong-ator-pos" required style="width:100%;">
                    <option value="" disabled ${!posicao ? 'selected' : ''}>Selecione...</option>
                    <option value="A favor (Lobby)" ${posicao === 'A favor (Lobby)' ? 'selected' : ''}>A favor do texto (Lobby)</option>
                    <option value="Oposição Técnica" ${posicao === 'Oposição Técnica' ? 'selected' : ''}>Oposição Técnica / Crítica</option>
                    <option value="Neutro / Informativo" ${posicao === 'Neutro / Informativo' ? 'selected' : ''}>Neutro / Informativo</option>
                </select>
            </div>
            <div class="form-group" style="flex: 100%; margin-bottom: 0;">
                <label>Resumo do Parecer / Nota Técnica</label>
                <input type="text" class="cong-ator-nota" placeholder="Ex: Emitiu Nota Técnica repudiando a dispensa de EIA..." value="${nota}" style="width:100%;">
            </div>
            ${isExtra ? `<button type="button" class="btn-action-delete btn-remove-ator" style="padding: 11px 14px; margin-bottom: 0; margin-top: 10px;"><i class="ph ph-trash"></i> Remover</button>` : ``}
        `;
        if (isExtra) row.querySelector(".btn-remove-ator").addEventListener("click", () => row.remove());
        atoresCongContainer.appendChild(row);
    }

    function criarLinhaTrechoLei(texto = "", comentario = "") {
        if (!trechosLeiContainer) return;
        const row = document.createElement("div");
        row.className = "trecho-lei-row";
        row.style = "display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; padding: 15px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; position: relative;";
        const isExtra = trechosLeiContainer.children.length > 0;

        row.innerHTML = `
            ${isExtra ? `<button type="button" class="btn-action-delete btn-remove-trecho" style="position: absolute; top: 10px; right: 10px; padding: 6px 10px;" title="Remover este trecho"><i class="ph ph-trash"></i></button>` : ''}
            <div class="form-group" style="margin-bottom: 0;">
                <label>Trecho da Lei / Norma</label>
                <textarea class="cong-trecho-texto" rows="3" placeholder="Cole aqui o trecho exato da norma..." required style="width:100%; font-family: monospace; font-size: 0.9rem; background: #f8faf9;">${texto}</textarea>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Comentário / Análise</label>
                <textarea class="cong-trecho-coment" rows="2" placeholder="Qual a sua análise técnica sobre este trecho?" required style="width:100%;">${comentario}</textarea>
            </div>
        `;
        if (isExtra) row.querySelector(".btn-remove-trecho").addEventListener("click", () => row.remove());
        trechosLeiContainer.appendChild(row);
    }

    if (btnAddProponente) btnAddProponente.addEventListener("click", () => criarLinhaProponente());
    if (btnAddAmicus) btnAddAmicus.addEventListener("click", () => criarLinhaAmicus());
    if (btnAddDispositivo) btnAddDispositivo.addEventListener("click", () => criarLinhaDispositivo());
    if (btnAddPrincipio) btnAddPrincipio.addEventListener("click", () => criarLinhaPrincipio());
    if (btnAddDoutrina) btnAddDoutrina.addEventListener("click", () => criarLinhaDoutrina());
    if (btnAddConstitucional) btnAddConstitucional.addEventListener("click", () => criarLinhaConstitucional());
    if (btnAddNormaCong) btnAddNormaCong.addEventListener("click", () => criarLinhaNormaCong());
    if (btnAddAtorCong) btnAddAtorCong.addEventListener("click", () => criarLinhaAtorCong());
    if (btnAddTrechoLei) btnAddTrechoLei.addEventListener("click", () => criarLinhaTrechoLei());

    if (proponentesContainer && proponentesContainer.children.length === 0) criarLinhaProponente();
    if (dispositivosContainer && dispositivosContainer.children.length === 0) criarLinhaDispositivo();
    if (principiosContainer && principiosContainer.children.length === 0) criarLinhaPrincipio();
    if (doutrinasContainer && doutrinasContainer.children.length === 0) criarLinhaDoutrina();
    if (constitucionaisContainer && constitucionaisContainer.children.length === 0) criarLinhaConstitucional();
    if (normasCongContainer && normasCongContainer.children.length === 0) criarLinhaNormaCong();
    if (atoresCongContainer && atoresCongContainer.children.length === 0) criarLinhaAtorCong();
    if (trechosLeiContainer && trechosLeiContainer.children.length === 0) criarLinhaTrechoLei();

    // ==========================================
    // GESTÃO DE MODAIS
    // ==========================================
    function resetFormMovimento() {
        if(formMovimento) {
            formMovimento.reset();
            formMovimento.removeAttribute("data-mode");
            formMovimento.removeAttribute("data-mov-id");
            formMovimento.removeAttribute("data-old-arquivo");
            
            const lExterno = document.getElementById("mov-link-externo");
            if(lExterno) lExterno.value = "";

            const titulo = document.getElementById("titulo-modal-mov");
            if (titulo) titulo.textContent = "Nova Movimentação";
            const btn = document.getElementById("btn-submit-mov");
            if (btn) btn.textContent = "Registrar Movimentação";
            const help = document.getElementById("mov-arquivo-help");
            if (help) help.style.display = "none";
        }
    }

    if (btnAbrirFormAdi) {
        btnAbrirFormAdi.addEventListener("click", () => {
            if (containerFormAdi) containerFormAdi.style.display = "flex"; 
            if (areaBotoesCadastros) areaBotoesCadastros.style.display = "none";
        });
    }

    if (fecharFormAdi) {
        fecharFormAdi.addEventListener("click", () => {
            if (containerFormAdi) containerFormAdi.style.display = "none"; 
            if (areaBotoesCadastros) areaBotoesCadastros.style.display = "flex";    
            if (formAdi) { formAdi.reset(); formAdi.removeAttribute("data-mode"); formAdi.removeAttribute("data-id"); }
            if (proponentesContainer) { proponentesContainer.innerHTML = ""; criarLinhaProponente(); }
            if (amicusContainer) amicusContainer.innerHTML = "";
            if (dispositivosContainer) { dispositivosContainer.innerHTML = ""; criarLinhaDispositivo(); }
            if (principiosContainer) { principiosContainer.innerHTML = ""; criarLinhaPrincipio(); }
            if (doutrinasContainer) { doutrinasContainer.innerHTML = ""; criarLinhaDoutrina(); }
            if (constitucionaisContainer) { constitucionaisContainer.innerHTML = ""; criarLinhaConstitucional(); }
            const btnSubmitAdi = document.getElementById("btn-submit-adi");
            if (btnSubmitAdi) btnSubmitAdi.textContent = "Publicar Análise da ADI";
        });
    }

    if (btnAbrirFormCongresso) {
        btnAbrirFormCongresso.addEventListener("click", () => {
            if (containerFormCongresso) containerFormCongresso.style.display = "flex"; 
            if (areaBotoesCadastros) areaBotoesCadastros.style.display = "none";
            if (normasCongContainer && normasCongContainer.children.length === 0) criarLinhaNormaCong();
            if (atoresCongContainer && atoresCongContainer.children.length === 0) criarLinhaAtorCong();
            if (trechosLeiContainer && trechosLeiContainer.children.length === 0) criarLinhaTrechoLei();
        });
    }

    if (fecharFormCongresso) {
        fecharFormCongresso.addEventListener("click", () => {
            if (containerFormCongresso) containerFormCongresso.style.display = "none"; 
            if (areaBotoesCadastros) areaBotoesCadastros.style.display = "flex";    
            if(formCongresso) {
                formCongresso.reset(); formCongresso.removeAttribute("data-mode"); formCongresso.removeAttribute("data-id");
                document.querySelectorAll('input[name="institutos-cong"]').forEach(cb => cb.checked = false);
            }
            if (normasCongContainer) { normasCongContainer.innerHTML = ""; criarLinhaNormaCong(); }
            if (atoresCongContainer) { atoresCongContainer.innerHTML = ""; criarLinhaAtorCong(); }
            if (trechosLeiContainer) { trechosLeiContainer.innerHTML = ""; criarLinhaTrechoLei(); }
            const btnSubmitCong = document.getElementById("btn-submit-congresso");
            if (btnSubmitCong) btnSubmitCong.textContent = "Publicar Análise Legislativa";
        });
    }

    if (fecharMovimento) fecharMovimento.addEventListener("click", () => { if (modalMovimento) modalMovimento.classList.add("hidden"); resetFormMovimento(); });
    if (fecharAdi) fecharAdi.addEventListener("click", () => { if (modalAdi) modalAdi.classList.add("hidden"); document.body.style.overflow = "auto"; });
    if (fecharCongresso) fecharCongresso.addEventListener("click", () => { if (modalCongresso) modalCongresso.classList.add("hidden"); document.body.style.overflow = "auto"; });
    const fecharDoutrinas = document.getElementById("fechar-doutrinas");
    if(fecharDoutrinas) fecharDoutrinas.addEventListener("click", () => { const m = document.getElementById("doutrinas-modal"); if(m) m.classList.add("hidden"); });
    const fecharPrincipios = document.getElementById("fechar-principios");
    if(fecharPrincipios) fecharPrincipios.addEventListener("click", () => { const m = document.getElementById("principios-modal"); if(m) m.classList.add("hidden"); });
    const fecharConstitucionais = document.getElementById("fechar-constitucionais");
    if(fecharConstitucionais) fecharConstitucionais.addEventListener("click", () => { const m = document.getElementById("constitucionais-modal"); if(m) m.classList.add("hidden"); });
    
    if (fecharPasswordModal) fecharPasswordModal.addEventListener("click", () => { if (passwordModal) passwordModal.classList.add("hidden"); acaoPendente = null; });
    if (btnCancelPassword) btnCancelPassword.addEventListener("click", () => { if (passwordModal) passwordModal.classList.add("hidden"); acaoPendente = null; });
    if (fecharShareModal) fecharShareModal.addEventListener("click", () => { if (shareModal) shareModal.classList.add("hidden"); });

    window.addEventListener("click", (e) => {
        if (modal && e.target === modal) modal.classList.add("hidden");
        const mD = document.getElementById("doutrinas-modal"); const mP = document.getElementById("principios-modal"); const mC = document.getElementById("constitucionais-modal");
        if (mD && e.target === mD) mD.classList.add("hidden");
        if (mP && e.target === mP) mP.classList.add("hidden");
        if (mC && e.target === mC) mC.classList.add("hidden");
        if (passwordModal && e.target === passwordModal) { passwordModal.classList.add("hidden"); acaoPendente = null; }
        if (shareModal && e.target === shareModal) shareModal.classList.add("hidden");
    });
    
    const fotoUpload = document.getElementById("foto-upload");
    if (fotoUpload && avatarPreview) {
        fotoUpload.addEventListener("change", function() {
            if (this.files[0]) {
                const reader = new FileReader();
                reader.onload = e => avatarPreview.setAttribute("src", e.target.result);
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    // ==========================================
    // AUTENTICAÇÃO E PERFIL
    // ==========================================
    if (formAuth) {
        formAuth.addEventListener("submit", (e) => {
            e.preventDefault();
            const emailEl = document.getElementById("email-auth"); const senhaEl = document.getElementById("senha-auth"); const btnSubmitAuth = document.getElementById("btn-submit-auth");
            if (!emailEl || !senhaEl || !btnSubmitAuth) return;
            const email = emailEl.value; const senha = senhaEl.value; const isCadastro = btnSubmitAuth.textContent === "Cadastrar";
            btnSubmitAuth.textContent = "Aguarde...";
            if (isCadastro) {
                createUserWithEmailAndPassword(auth, email, senha).then(() => { alert("Conta criada!"); if (modal) modal.classList.add("hidden"); formAuth.reset(); }).catch(err => { alert("Erro: " + err.message); btnSubmitAuth.textContent = "Cadastrar"; });
            } else {
                signInWithEmailAndPassword(auth, email, senha).then(() => { alert("Bem-vindo!"); if (modal) modal.classList.add("hidden"); formAuth.reset(); }).catch(err => { alert("Credenciais inválidas."); btnSubmitAuth.textContent = "Entrar"; });
            }
        });
    }

    if (formPerfil) {
        formPerfil.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (user) {
                const btn = formPerfil.querySelector('button'); if (btn) btn.textContent = "Salvando...";
                let urlFoto = avatarPreview ? avatarPreview.getAttribute("src") : "";
                const fotoUpload = document.getElementById("foto-upload"); const file = fotoUpload ? fotoUpload.files[0] : null;
                if (file) {
                    const fd = new FormData(); fd.append("file", file); fd.append("upload_preset", "mldefault"); 
                    try {
                        const r = await fetch(`https://api.cloudinary.com/v1_1/df1wbmtf1/image/upload`, { method: "POST", body: fd });
                        if (r.ok) urlFoto = (await r.json()).secure_url;
                    } catch(err) { console.error(err); }
                }
                const nomeEl = document.getElementById("nome-usuario"); const vinculoEl = document.querySelector('input[name="vinculo"]:checked');
                const uniEl = document.getElementById("universidade"); const cursoEl = document.getElementById("curso"); const anoEl = document.getElementById("ano-faculdade");
                await setDoc(doc(db, "usuarios", user.uid), {
                    nome: nomeEl ? nomeEl.value : "", vinculo: vinculoEl ? vinculoEl.value : "",
                    universidade: uniEl ? uniEl.value : "", curso: cursoEl ? cursoEl.value : "",
                    ano: anoEl ? anoEl.value : "", foto: urlFoto, email: user.email
                }, { merge: true });
                if (btn) btn.textContent = "Salvar Alterações"; alert("Perfil salvo!");

            }

            
        });
    }

    

    // ==========================================
    // HISTÓRICO PESSOAL DO USUÁRIO E GERENCIAMENTO DE EDIÇÃO
    // ==========================================
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserEmail = user.email; 
            if(navLoginBtn) navLoginBtn.style.display = "none";
            if(navUserMenu) navUserMenu.style.display = "block";
            
            const displayEmail = document.getElementById("profile-display-email");
            if (displayEmail) displayEmail.textContent = user.email;

            try {
                const docSnap = await getDoc(doc(db, "usuarios", user.uid));
                if (docSnap.exists()) {
                    const dados = docSnap.data();
                    const nU = document.getElementById("nome-usuario"); if (nU) nU.value = dados.nome || "";
                    const univ = document.getElementById("universidade"); if (univ) univ.value = dados.universidade || "";
                    if (dados.foto && dados.foto.startsWith("http") && avatarPreview) { avatarPreview.setAttribute("src", dados.foto); }
                }
            } catch (error) { console.error(error); }

            // 1. CARREGAR HISTÓRICO DE ADIs
            unsubscribeHistorico = onSnapshot(query(collection(db, "adis"), orderBy("createdAt", "desc")), (snapshot) => {
                if (!historicoAdiGrid) return;
                historicoAdiGrid.innerHTML = ""; let temAdis = false; let cacheHistorico = {};

                snapshot.forEach((docSnap) => {
                    const adi = docSnap.data();
                    const isCreator = adi.autorEmail === user.email;
                    const isEditor = adi.editoresPermitidos && adi.editoresPermitidos.includes(user.email);

                    if (isCreator || isEditor) {
                        temAdis = true; cacheHistorico[docSnap.id] = adi;
                        let contagemMov = adi.movimentacoes ? adi.movimentacoes.length : 0;
                        let linkStfHist = adi.linkSTF ? `<a href="${adi.linkSTF}" target="_blank" class="tag" style="background: #e0f2fe; color: #0284c7; text-decoration: none;"><i class="ph ph-arrow-square-out"></i> STF</a>` : "";
                        let tagColab = isEditor && !isCreator ? `<span class="tag" style="background: #fae8ff; color: #a21caf; margin-left: 8px;">Colaborador</span>` : "";

                        let btnShareHtml = isCreator ? `<button class="btn-action-share btn-compartilhar-adi" data-id="${docSnap.id}"><i class="ph ph-share-network"></i> Compartilhar</button>` : "";
                        let btnDeleteHtml = isCreator ? `<button class="btn-action-delete btn-excluir-adi" data-id="${docSnap.id}"><i class="ph ph-trash"></i></button>` : "";

                        historicoAdiGrid.innerHTML += `
                            <div class="modern-card">
                                <div class="card-content" style="padding-top:1.5rem; display:flex; flex-direction:column; height:100%;">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                        <div><span class="tag tag-stf">ADI ${adi.numero || "S/N"}</span>${tagColab}</div>
                                        ${linkStfHist}
                                    </div>
                                    <h3 style="margin-top:5px; font-size:1.1rem;">${adi.titulo || "Sem Título"}</h3>
                                    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom: 1rem;"><i class="ph ph-clock"></i> ${contagemMov} Movimentações</p>
                                    
                                    <div class="adi-actions" style="margin-top: auto; flex-wrap: wrap;">
                                        <button class="btn-action-mov btn-add-mov" data-id="${docSnap.id}"><i class="ph ph-plus"></i> Andamento</button>
                                        <button class="btn-action-edit btn-editar-adi" data-id="${docSnap.id}"><i class="ph ph-pencil-simple"></i> Editar</button>
                                        ${btnShareHtml}
                                        ${btnDeleteHtml}
                                    </div>
                                </div>
                            </div>`;
                    }
                });

                if (!temAdis) historicoAdiGrid.innerHTML = "<p style='text-align:center; grid-column: 1/-1;'>Você não mapeou nenhuma ADI.</p>";

                historicoAdiGrid.querySelectorAll(".btn-compartilhar-adi").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const id = btn.getAttribute("data-id");
                        currentShareAdiId = id;
                        const adi = cacheHistorico[id];
                        renderShareList(adi.editoresPermitidos || [], id);
                        if(shareModal) shareModal.classList.remove("hidden");
                    });
                });

                historicoAdiGrid.querySelectorAll(".btn-add-mov").forEach(btn => {
                    btn.addEventListener("click", () => { 
                        resetFormMovimento(); 
                        idParaMovimentacao = btn.getAttribute("data-id"); 
                        colecaoMovimentacao = "adis";
                        const titulo = document.getElementById("titulo-modal-mov");
                        if (titulo) titulo.textContent = "Novo Andamento STF";
                        if (modalMovimento) modalMovimento.classList.remove("hidden"); 
                    });
                });

                historicoAdiGrid.querySelectorAll(".btn-editar-adi").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const id = btn.getAttribute("data-id"); const adi = cacheHistorico[id];
                        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ""; };
                        
                        setVal("adi-numero", adi.numero); setVal("adi-relator", adi.relator); setVal("adi-titulo", adi.titulo);
                        setVal("adi-link", adi.linkSTF); setVal("adi-status", adi.status); setVal("adi-analise", adi.analise);
                        
                        if (proponentesContainer) { proponentesContainer.innerHTML = ""; if (adi.proponentes && adi.proponentes.length > 0) adi.proponentes.forEach(p => criarLinhaProponente(p.nome, p.tipo)); else criarLinhaProponente(); }
                        if (amicusContainer) { amicusContainer.innerHTML = ""; if (adi.amicus && adi.amicus.length > 0) adi.amicus.forEach(a => criarLinhaAmicus(a.nome, a.tipo, a.posicao)); }
                        if (dispositivosContainer) { dispositivosContainer.innerHTML = ""; if (adi.dispositivos && adi.dispositivos.length > 0) adi.dispositivos.forEach(d => criarLinhaDispositivo(d.texto, d.justificativa, d.status)); else criarLinhaDispositivo(); }
                        if (principiosContainer) { principiosContainer.innerHTML = ""; if (adi.principios && adi.principios.length > 0) adi.principios.forEach(p => criarLinhaPrincipio(p.nome, p.aplicacao, p.ator, p.documento)); else criarLinhaPrincipio(); }
                        if (doutrinasContainer) { doutrinasContainer.innerHTML = ""; if (adi.doutrinas && adi.doutrinas.length > 0) adi.doutrinas.forEach(dou => criarLinhaDoutrina(dou.conceito, dou.autor, dou.obra, dou.documento)); else criarLinhaDoutrina(); }
                        if (constitucionaisContainer) { constitucionaisContainer.innerHTML = ""; if (adi.constitucionais && adi.constitucionais.length > 0) adi.constitucionais.forEach(c => criarLinhaConstitucional(c.dispositivo, c.fundamento, c.ator, c.documento)); else criarLinhaConstitucional(); }

                        if (formAdi) { formAdi.dataset.mode = "edit"; formAdi.dataset.id = id; }
                        const btnS = document.getElementById("btn-submit-adi"); if(btnS) btnS.textContent = "Salvar Alterações";
                        
                        if (containerFormAdi) containerFormAdi.style.display = "flex"; 
                        if (areaBotoesCadastros) areaBotoesCadastros.style.display = "none";
                        if (containerFormAdi) containerFormAdi.scrollIntoView({ behavior: 'smooth' });
                    });
                });

                historicoAdiGrid.querySelectorAll(".btn-excluir-adi").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const id = btn.getAttribute("data-id");
                        const adi = cacheHistorico[id];
                        if (confirm("Excluir esta ADI permanentemente?")) {
                            pedirSenhaEExecutar(async () => {
                                await deleteDoc(doc(db, "adis", id));
                                await registrarLogAtividade("EXCLUSÃO", "ADI", `Excluiu a ADI ${adi ? adi.numero : ""}`, `ADI ${adi ? adi.numero : ""}`);
                                alert("ADI excluída com sucesso.");
                            });
                        }
                    });
                });
            }, (error) => {
                console.error("Erro ao carregar histórico de ADIs:", error);
                if (historicoAdiGrid) historicoAdiGrid.innerHTML = `<p style='text-align:center;color:#ef4444;'>Erro ao carregar seu histórico.</p>`;
            });

            // 2. CARREGAR HISTÓRICO DO CONGRESSO
            if(unsubscribeHistoricoCong) unsubscribeHistoricoCong();
            
            unsubscribeHistoricoCong = onSnapshot(query(collection(db, "congresso"), orderBy("createdAt", "desc")), (snapshot) => {
                if (!historicoCongressoGrid) return;
                historicoCongressoGrid.innerHTML = ""; let temProjetos = false; let cacheHistoricoCong = {};

                snapshot.forEach((docSnap) => {
                    const proj = docSnap.data();
                    if (proj.autorEmail === user.email) {
                        temProjetos = true; cacheHistoricoCong[docSnap.id] = proj;
                        let corStatus = proj.regime === "Urgência" ? "#ef4444" : "#db2777";
                        let resumo = (proj.ementa || "").substring(0, 100) + "...";
                        let contagemMovCong = proj.movimentacoes ? proj.movimentacoes.length : 0;

                        historicoCongressoGrid.innerHTML += `
                            <div class="modern-card congresso-card">
                                <div class="card-content" style="padding-top:1.5rem; display:flex; flex-direction:column; height:100%;">
                                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                        <span class="tag tag-congresso">${proj.tipo || ""} ${proj.numero || ""}</span>
                                        <span class="tag" style="background: ${corStatus}15; color: ${corStatus}; border: 1px solid ${corStatus}40;">${proj.regime || ""}</span>
                                    </div>
                                    <h3 style="margin-top:10px; font-size: 1.1rem;">${resumo}</h3>
                                    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom: 1rem;"><i class="ph ph-clock"></i> ${contagemMovCong} Andamentos</p>
                                    
                                    <div class="adi-actions" style="margin-top: auto; padding-top: 15px;">
                                        <button class="btn-action-mov btn-add-mov-cong" data-id="${docSnap.id}"><i class="ph ph-plus"></i> Andamento</button>
                                        <button class="btn-action-edit btn-editar-cong" data-id="${docSnap.id}"><i class="ph ph-pencil-simple"></i> Editar</button>
                                        <button class="btn-action-delete btn-excluir-cong" data-id="${docSnap.id}"><i class="ph ph-trash"></i></button>
                                    </div>
                                </div>
                            </div>`;
                    }
                });

                if (!temProjetos) historicoCongressoGrid.innerHTML = "<p style='text-align:center; grid-column: 1/-1;'>Você não mapeou nenhum projeto legislativo.</p>";

                historicoCongressoGrid.querySelectorAll(".btn-add-mov-cong").forEach(btn => {
                    btn.addEventListener("click", () => { 
                        resetFormMovimento(); 
                        idParaMovimentacao = btn.getAttribute("data-id"); 
                        colecaoMovimentacao = "congresso";
                        const titulo = document.getElementById("titulo-modal-mov");
                        if (titulo) titulo.textContent = "Novo Andamento Legislativo";
                        if (modalMovimento) modalMovimento.classList.remove("hidden"); 
                    });
                });

                historicoCongressoGrid.querySelectorAll(".btn-editar-cong").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const id = btn.getAttribute("data-id"); const proj = cacheHistoricoCong[id];
                        
                        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ""; };
                        setVal("cong-tipo", proj.tipo); setVal("cong-numero", proj.numero); setVal("cong-autor", proj.autor);
                        setVal("cong-partido", proj.partido); setVal("cong-link", proj.linkOficial); setVal("cong-ementa", proj.ementa);
                        setVal("cong-casa", proj.casa); setVal("cong-regime", proj.regime); setVal("cong-status", proj.status);
                        setVal("cong-comissao", proj.comissao); setVal("cong-relator", proj.relator); setVal("cong-posicao", proj.posicaoRelator);
                        setVal("cong-analise", proj.analise);

                        document.querySelectorAll('input[name="institutos-cong"]').forEach(cb => { cb.checked = proj.institutos && proj.institutos.includes(cb.value); });
                        
                        if (normasCongContainer) { normasCongContainer.innerHTML = ""; if (proj.normas && proj.normas.length > 0) proj.normas.forEach(n => criarLinhaNormaCong(n.norma, n.impacto)); else criarLinhaNormaCong(); }
                        if (atoresCongContainer) { atoresCongContainer.innerHTML = ""; if (proj.atores && proj.atores.length > 0) proj.atores.forEach(a => criarLinhaAtorCong(a.nome, a.posicao, a.nota)); else criarLinhaAtorCong(); }
                        if (trechosLeiContainer) { trechosLeiContainer.innerHTML = ""; if (proj.trechos && proj.trechos.length > 0) proj.trechos.forEach(t => criarLinhaTrechoLei(t.texto, t.comentario)); else criarLinhaTrechoLei(); }

                        if (formCongresso) { formCongresso.dataset.mode = "edit"; formCongresso.dataset.id = id; }
                        const btnS = document.getElementById("btn-submit-congresso"); if(btnS) btnS.textContent = "Salvar Alterações";
                        
                        if (containerFormCongresso) containerFormCongresso.style.display = "flex"; 
                        if (areaBotoesCadastros) areaBotoesCadastros.style.display = "none";
                        if (containerFormCongresso) containerFormCongresso.scrollIntoView({ behavior: 'smooth' });
                    });
                });

                historicoCongressoGrid.querySelectorAll(".btn-excluir-cong").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const id = btn.getAttribute("data-id");
                        const proj = cacheHistoricoCong[id];
                        if (confirm("Excluir esta análise legislativa permanentemente?")) {
                            pedirSenhaEExecutar(async () => {
                                await deleteDoc(doc(db, "congresso", id));
                                await registrarLogAtividade("EXCLUSÃO", "CONGRESSO", `Excluiu a proposição ${proj ? proj.tipo + ' ' + proj.numero : ""}`, `CONGRESSO ${proj ? proj.numero : ""}`);
                                alert("Proposição excluída com sucesso.");
                            });
                        }
                    });
                });
            }, (error) => {
                console.error("Erro ao carregar histórico legislativo:", error);
                if (historicoCongressoGrid) historicoCongressoGrid.innerHTML = `<p style='text-align:center;color:#ef4444;'>Erro ao carregar seu histórico legislativo.</p>`;
            });

            // 3. CARREGAR HISTÓRICO DE AUDITORIA (ÚLTIMOS 30 DIAS)
            const logsContainer = document.getElementById("logs-atividades-container");
            const limiteTrintaDias = new Date();
            limiteTrintaDias.setDate(limiteTrintaDias.getDate() - 30);

            onSnapshot(query(collection(db, "logs_atividades"), orderBy("dataRegistroISO", "desc")), (snapshot) => {
                if (!logsContainer) return;
                
                let temRegistrosRecentes = false;
                let htmlTemp = "";

                if (snapshot.empty) {
                    logsContainer.innerHTML = "<p class='audit-empty-message'>Nenhuma atividade registrada nos últimos 30 dias.</p>";
                    return;
                }

                snapshot.forEach(docSnap => {
                    const log = docSnap.data();
                    const dataLog = log.dataRegistroISO ? new Date(log.dataRegistroISO) : (log.dataHora ? log.dataHora.toDate() : new Date());
                    
                    if (dataLog >= limiteTrintaDias) {
                        temRegistrosRecentes = true;
                        const dataHoraFormatada = dataLog.toLocaleString("pt-BR");
                        
                        let classeBadge = "edicao";
                        let iconeBadge = "ph-pencil-simple";

                        if (log.tipoAcao === "CRIAÇÃO") { classeBadge = "criacao"; iconeBadge = "ph-plus-circle"; }
                        if (log.tipoAcao === "EXCLUSÃO") { classeBadge = "exclusao"; iconeBadge = "ph-trash"; }
                        if (log.tipoAcao === "NOVO_ANDAMENTO") { classeBadge = "andamento"; iconeBadge = "ph-files"; }

                        htmlTemp += `
                            <div class="log-item">
                                <span class="log-badge ${classeBadge}"><i class="ph ${iconeBadge}"></i> ${log.tipoAcao}</span>
                                <div class="log-detalhes">
                                    <p><strong>${log.usuarioNome}</strong> ${log.descricao}</p>
                                    <div class="log-meta">
                                        <span><i class="ph ph-calendar"></i> ${dataHoraFormatada}</span>
                                        <span><i class="ph ph-envelope"></i> ${log.usuarioEmail}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                });

                if (temRegistrosRecentes) {
                    logsContainer.innerHTML = htmlTemp;
                } else {
                    logsContainer.innerHTML = "<p class='audit-empty-message'>Nenhuma atividade registrada nos últimos 30 dias.</p>";
                }
            }, (error) => {
                console.error("Erro ao carregar auditoria:", error);
                if (logsContainer) logsContainer.innerHTML = `<p class='audit-empty-message' style="color: #ef4444;">Acesso negado ou erro ao carregar os logs.</p>`;
            });

            if(btnLogout) btnLogout.onclick = () => { signOut(auth).then(() => window.location.reload()); };
        } else {
            currentUserEmail = null;
            if(navLoginBtn) navLoginBtn.style.display = "block";
            if(navUserMenu) navUserMenu.style.display = "none";
            
            const sEspaco = document.getElementById("espaco");
            const sPerfil = document.getElementById("perfil");
            const sAuditoria = document.getElementById("historico-atividades");
            if ((sEspaco && sEspaco.classList.contains("active")) || (sPerfil && sPerfil.classList.contains("active")) || (sAuditoria && sAuditoria.classList.contains("active"))) {
                const btnHome = document.querySelector('[data-target="home"]');
                if (btnHome) btnHome.click();
            }

            if(unsubscribeHistorico) unsubscribeHistorico();
            if(unsubscribeHistoricoCong) unsubscribeHistoricoCong();
        }
    });

    // ==========================================
    // EXIBIÇÃO NOS MURAIS PÚBLICOS E INTERCEPÇÃO DE SENHA
    // ==========================================
    if (formAdi) {
        formAdi.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return alert("Faça login para publicar.");

            // Coletar Dados da ADI
            const listaProponentes = [];
            document.querySelectorAll(".proponente-row").forEach(linha => {
                const nome = linha.querySelector(".prop-nome").value;
                const tipo = linha.querySelector(".prop-tipo").value;
                if (nome && tipo) listaProponentes.push({ nome, tipo });
            });

            const listaAmicus = [];
            document.querySelectorAll(".amicus-row").forEach(linha => {
                const nome = linha.querySelector(".ami-nome").value;
                const tipo = linha.querySelector(".ami-tipo").value;
                const pos = linha.querySelector(".ami-pos").value;
                if (nome && tipo && pos) listaAmicus.push({ nome, tipo, posicao: pos });
            });

            const listaDispositivos = [];
            document.querySelectorAll(".dispositivo-row").forEach(linha => {
                const texto = linha.querySelector(".disp-texto").value;
                const justificativa = linha.querySelector(".disp-justificativa").value;
                const status = linha.querySelector(".disp-status").value;
                if (texto && justificativa && status) listaDispositivos.push({ texto, justificativa, status });
            });

            const listaPrincipios = [];
            document.querySelectorAll(".principio-row").forEach(linha => {
                const nome = linha.querySelector(".prin-nome").value;
                const aplicacao = linha.querySelector(".prin-aplicacao").value;
                const ator = linha.querySelector(".prin-ator").value;
                const documento = linha.querySelector(".prin-documento").value;
                if (nome && aplicacao && ator && documento) listaPrincipios.push({ nome, aplicacao, ator, documento });
            });

            const listaDoutrinas = [];
            document.querySelectorAll(".doutrina-row").forEach(linha => {
                const conceito = linha.querySelector(".dou-conceito").value;
                const autor = linha.querySelector(".dou-autor").value;
                const obra = linha.querySelector(".dou-obra").value;
                const documento = linha.querySelector(".dou-documento").value;
                if (conceito && autor && obra && documento) listaDoutrinas.push({ conceito, autor, obra, documento });
            });

            const listaConstitucionais = [];
            document.querySelectorAll(".constitucional-row").forEach(linha => {
                const dispositivo = linha.querySelector(".const-dispositivo").value;
                const fundamento = linha.querySelector(".const-fundamento").value;
                const ator = linha.querySelector(".const-ator").value;
                const documento = linha.querySelector(".const-documento").value;
                if (dispositivo && fundamento && ator && documento) listaConstitucionais.push({ dispositivo, fundamento, ator, documento });
            });

            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            const numEl = document.getElementById("adi-numero");
            const relEl = document.getElementById("adi-relator");
            const titEl = document.getElementById("adi-titulo");
            const linkEl = document.getElementById("adi-link");
            const statEl = document.getElementById("adi-status");
            const analEl = document.getElementById("adi-analise");

            const dadosAdi = {
                numero: numEl ? numEl.value : "",
                relator: relEl ? relEl.value : "",
                titulo: titEl ? titEl.value : "",
                linkSTF: linkEl ? linkEl.value : "", 
                status: statEl ? statEl.value : "",
                analise: analEl ? analEl.value : "",
                proponentes: listaProponentes,
                amicus: listaAmicus,
                dispositivos: listaDispositivos,
                principios: listaPrincipios,
                doutrinas: listaDoutrinas,
                constitucionais: listaConstitucionais
            };

            // Pedir senha e, se correto, salvar no banco
            pedirSenhaEExecutar(async () => {
                const btnAdiDefault = document.getElementById("btn-submit-adi");
                const modoEdicao = formAdi.dataset.mode === "edit";
                const id = formAdi.dataset.id;
                if (btnAdiDefault) btnAdiDefault.textContent = "Salvando...";

                try {
                    if (modoEdicao) {
                        const existingDoc = await getDoc(doc(db, "adis", id));
                        if (existingDoc.exists()) {
                            const oldData = existingDoc.data();
                            dadosAdi.autorEmail = oldData.autorEmail; 
                            dadosAdi.autorInstituicao = oldData.autorInstituicao; 
                            dadosAdi.editoresPermitidos = oldData.editoresPermitidos || []; 

                            let currentNames = oldData.autorNome || "";
                            const currentUserNome = userDoc.exists() ? userDoc.data().nome : "Pesquisador";
                            
                            if (!currentNames.includes(currentUserNome)) {
                                dadosAdi.autorNome = currentNames + ", " + currentUserNome;
                            } else {
                                dadosAdi.autorNome = currentNames;
                            }
                        }

                        dadosAdi.updatedAt = serverTimestamp();
                        await updateDoc(doc(db, "adis", id), dadosAdi);
                        await registrarLogAtividade("EDIÇÃO", "ADI", `Alterou a análise da ADI ${dadosAdi.numero}`, `ADI ${dadosAdi.numero}`);
                        alert("Atualizado com sucesso!");
                    } else {
                        dadosAdi.autorNome = userDoc.exists() ? userDoc.data().nome : "Pesquisador";
                        dadosAdi.autorInstituicao = userDoc.exists() ? userDoc.data().universidade : "Sanfran";
                        dadosAdi.autorEmail = user.email;
                        dadosAdi.editoresPermitidos = []; 
                        
                        dadosAdi.createdAt = serverTimestamp();
                        dadosAdi.movimentacoes = []; 
                        await addDoc(collection(db, "adis"), dadosAdi);
                        await registrarLogAtividade("CRIAÇÃO", "ADI", `Cadastrou uma nova análise: ADI ${dadosAdi.numero} (${dadosAdi.titulo})`, `ADI ${dadosAdi.numero}`);
                        alert("Publicado com sucesso!");
                    }

                    formAdi.reset(); formAdi.removeAttribute("data-mode"); formAdi.removeAttribute("data-id");
                    if (proponentesContainer) { proponentesContainer.innerHTML = ""; criarLinhaProponente(); }
                    if (amicusContainer) amicusContainer.innerHTML = "";
                    if (dispositivosContainer) { dispositivosContainer.innerHTML = ""; criarLinhaDispositivo(); }
                    if (principiosContainer) { principiosContainer.innerHTML = ""; criarLinhaPrincipio(); }
                    if (doutrinasContainer) { doutrinasContainer.innerHTML = ""; criarLinhaDoutrina(); }
                    if (constitucionaisContainer) { constitucionaisContainer.innerHTML = ""; criarLinhaConstitucional(); }
                    if (containerFormAdi) containerFormAdi.style.display = "none"; 
                    if (areaBotoesCadastros) areaBotoesCadastros.style.display = "flex";
                } catch (err) {
                    alert("Erro ao salvar a ADI.");
                } finally {
                    if (btnAdiDefault) btnAdiDefault.textContent = "Publicar Análise da ADI";
                }
            });
        });
    }

    if (formMovimento) {
        formMovimento.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!idParaMovimentacao || !colecaoMovimentacao) return;

            const modoEdicao = formMovimento.dataset.mode === "edit";
            const btn = document.getElementById("btn-submit-mov");
            const fileEl = document.getElementById("mov-arquivo");
            const file = fileEl ? fileEl.files[0] : null;
            let arquivoUrl = modoEdicao ? formMovimento.dataset.oldArquivo : null;

            if (file) {
                if (btn) btn.textContent = "Anexando Arquivo...";
                const fd = new FormData(); fd.append("file", file); fd.append("upload_preset", "mldefault"); 
                try {
                    const r = await fetch(`https://api.cloudinary.com/v1_1/df1wbmtf1/image/upload`, { method: "POST", body: fd });
                    if (r.ok) arquivoUrl = (await r.json()).secure_url;
                } catch(err) { console.error(err); }
            }

            const docRef = doc(db, colecaoMovimentacao, idParaMovimentacao);
            const dataEl = document.getElementById("mov-data");
            const descEl = document.getElementById("mov-descricao");
            const linkExternoEl = document.getElementById("mov-link-externo"); 
            const dataVal = dataEl ? dataEl.value : "";
            const descVal = descEl ? descEl.value : "";
            const linkVal = linkExternoEl ? linkExternoEl.value : "";

            pedirSenhaEExecutar(async () => {
                if (btn) btn.textContent = modoEdicao ? "Salvando Alterações..." : "Registrando...";
                try {
                    if (modoEdicao) {
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                            let movs = docSnap.data().movimentacoes || [];
                            const movIndex = movs.findIndex(m => m.dataRegistro === formMovimento.dataset.movId);
                            if (movIndex !== -1) {
                                movs[movIndex].data = dataVal;
                                movs[movIndex].descricao = descVal;
                                movs[movIndex].linkExterno = linkVal;
                                movs[movIndex].arquivo = arquivoUrl;
                                await updateDoc(docRef, { movimentacoes: movs });
                                await registrarLogAtividade("EDIÇÃO", "ANDAMENTO", `Editou um andamento processual existente`, idParaMovimentacao);
                                alert("Andamento atualizado! (Reabra para conferir)");
                            }
                        }
                    } else {
                        await updateDoc(docRef, {
                            movimentacoes: arrayUnion({
                                data: dataVal,
                                descricao: descVal,
                                linkExterno: linkVal,
                                arquivo: arquivoUrl,
                                dataRegistro: new Date().toISOString() 
                            })
                        });
                        await registrarLogAtividade("NOVO_ANDAMENTO", "ANDAMENTO", `Adicionou um andamento: "${descVal.substring(0, 40)}..."`, idParaMovimentacao);
                        alert("Movimentação registrada com sucesso!");
                    }
                    if (modalMovimento) modalMovimento.classList.add("hidden"); 
                    resetFormMovimento();
                } catch (error) { 
                    alert("Erro ao registrar movimentação."); 
                } finally {
                    if (btn) btn.textContent = "Registrar Movimentação";
                }
            });
        });
    }

    if (formCongresso) {
        formCongresso.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return alert("Faça login para publicar.");

            const institutosSelecionados = Array.from(document.querySelectorAll('input[name="institutos-cong"]:checked')).map(cb => cb.value);

            const listaNormas = [];
            document.querySelectorAll(".norma-cong-row").forEach(linha => {
                const norma = linha.querySelector(".cong-norma-nome").value;
                const impacto = linha.querySelector(".cong-norma-impacto").value;
                if (norma) listaNormas.push({ norma, impacto });
            });

            const listaAtores = [];
            document.querySelectorAll(".ator-cong-row").forEach(linha => {
                const nome = linha.querySelector(".cong-ator-nome").value;
                const posicao = linha.querySelector(".cong-ator-pos").value;
                const nota = linha.querySelector(".cong-ator-nota").value;
                if (nome) listaAtores.push({ nome, posicao, nota });
            });

            const listaTrechos = [];
            document.querySelectorAll(".trecho-lei-row").forEach(linha => {
                const texto = linha.querySelector(".cong-trecho-texto").value;
                const comentario = linha.querySelector(".cong-trecho-coment").value;
                if (texto) listaTrechos.push({ texto, comentario });
            });

            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            
            const tEl = document.getElementById("cong-tipo");
            const nEl = document.getElementById("cong-numero");
            const aEl = document.getElementById("cong-autor");
            const pEl = document.getElementById("cong-partido");
            const lEl = document.getElementById("cong-link");
            const eEl = document.getElementById("cong-ementa");
            const cEl = document.getElementById("cong-casa");
            const rEl = document.getElementById("cong-regime");
            const sEl = document.getElementById("cong-status");
            const cmEl = document.getElementById("cong-comissao");
            const relEl = document.getElementById("cong-relator");
            const posEl = document.getElementById("cong-posicao");
            const anEl = document.getElementById("cong-analise");

            const dadosCongresso = {
                tipo: tEl ? tEl.value : "",
                numero: nEl ? nEl.value : "",
                autor: aEl ? aEl.value : "",
                partido: pEl ? pEl.value : "",
                linkOficial: lEl ? lEl.value : "",
                ementa: eEl ? eEl.value : "",
                casa: cEl ? cEl.value : "",
                regime: rEl ? rEl.value : "",
                status: sEl ? sEl.value : "",
                comissao: cmEl ? cmEl.value : "",
                relator: relEl ? relEl.value : "",
                posicaoRelator: posEl ? posEl.value : "",
                analise: anEl ? anEl.value : "",
                institutos: institutosSelecionados,
                normas: listaNormas,
                atores: listaAtores,
                trechos: listaTrechos,
                autorNome: userDoc.exists() ? userDoc.data().nome : "Pesquisador",
                autorEmail: user.email
            };

            pedirSenhaEExecutar(async () => {
                const btn = document.getElementById("btn-submit-congresso");
                const modoEdicao = formCongresso.dataset.mode === "edit";
                const id = formCongresso.dataset.id;
                if (btn) btn.textContent = modoEdicao ? "Salvando..." : "Publicando...";

                try {
                    if (modoEdicao) {
                        dadosCongresso.updatedAt = serverTimestamp();
                        await updateDoc(doc(db, "congresso", id), dadosCongresso);
                        await registrarLogAtividade("EDIÇÃO", "CONGRESSO", `Alterou a análise da proposição ${dadosCongresso.tipo} ${dadosCongresso.numero}`, `CONGRESSO ${dadosCongresso.numero}`);
                        alert("Análise Legislativa atualizada com sucesso!");
                    } else {
                        dadosCongresso.createdAt = serverTimestamp();
                        dadosCongresso.movimentacoes = []; 
                        await addDoc(collection(db, "congresso"), dadosCongresso);
                        await registrarLogAtividade("CRIAÇÃO", "CONGRESSO", `Cadastrou o mapeamento legislativo: ${dadosCongresso.tipo} ${dadosCongresso.numero}`, `CONGRESSO ${dadosCongresso.numero}`);
                        alert("Análise Legislativa publicada com sucesso!");
                    }
                    
                    formCongresso.reset(); 
                    formCongresso.removeAttribute("data-mode");
                    formCongresso.removeAttribute("data-id");
                    document.querySelectorAll('input[name="institutos-cong"]').forEach(cb => cb.checked = false);

                    if (normasCongContainer) { normasCongContainer.innerHTML = ""; criarLinhaNormaCong(); }
                    if (atoresCongContainer) { atoresCongContainer.innerHTML = ""; criarLinhaAtorCong(); }
                    if (trechosLeiContainer) { trechosLeiContainer.innerHTML = ""; criarLinhaTrechoLei(); }
                    
                    if (containerFormCongresso) containerFormCongresso.style.display = "none"; 
                    if (areaBotoesCadastros) areaBotoesCadastros.style.display = "flex";

                } catch (err) { 
                    alert("Erro ao salvar: " + err.message); 
                } finally {
                    if (btn) btn.textContent = "Publicar Análise Legislativa";
                }
            });
        });
    }

    if (stfGrid) {
        let todasAdis = [];
        let cacheAdis = {};

        const inputBuscaGeral = document.getElementById("busca-adi-geral");
        const inputFiltroRelator = document.getElementById("filtro-adi-relator");
        const inputFiltroRequerente = document.getElementById("filtro-adi-requerente");

        const renderAdis = () => {
            if (!stfGrid) return;
            stfGrid.innerHTML = "";
            const termoGeral = inputBuscaGeral ? inputBuscaGeral.value.toLowerCase() : "";
            const termoRelator = inputFiltroRelator ? inputFiltroRelator.value.toLowerCase() : "";
            const termoRequerente = inputFiltroRequerente ? inputFiltroRequerente.value.toLowerCase() : "";

            let filtrados = todasAdis.filter(adi => {
                // BLINDAGEM CONTRA ERROS DE TIPO: Garante que tudo é string antes do toLowerCase()
                const numStr = adi.numero ? String(adi.numero).toLowerCase() : "";
                const titStr = adi.titulo ? String(adi.titulo).toLowerCase() : "";
                const analiseStr = adi.analise ? String(adi.analise).toLowerCase() : "";
                const relatorStr = adi.relator ? String(adi.relator).toLowerCase() : "";

                const matchGeral = termoGeral === "" || 
                                   numStr.includes(termoGeral) ||
                                   titStr.includes(termoGeral) ||
                                   analiseStr.includes(termoGeral);
                
                const matchRelator = termoRelator === "" || relatorStr.includes(termoRelator);
                
                let matchRequerente = termoRequerente === "";
                if (!matchRequerente && adi.proponentes) {
                    matchRequerente = adi.proponentes.some(p => {
                        const pNome = p.nome ? String(p.nome).toLowerCase() : "";
                        const pTipo = p.tipo ? String(p.tipo).toLowerCase() : "";
                        return pNome.includes(termoRequerente) || pTipo.includes(termoRequerente);
                    });
                }

                return matchGeral && matchRelator && matchRequerente;
            });

            if (filtrados.length === 0) {
                stfGrid.innerHTML = "<p style='grid-column: 1/-1;text-align:center;color:var(--text-muted); padding: 2rem;'>Nenhuma ADI encontrada com esses filtros.</p>";
                return;
            }

            filtrados.forEach(adi => {
                let resumo = (adi.analise || "").substring(0, 130) + "...";
                let linkStfCard = adi.linkSTF ? `<a href="${adi.linkSTF}" target="_blank" class="tag" style="background: #e0f2fe; color: #0284c7; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;"><i class="ph ph-arrow-square-out"></i> Acesso STF</a>` : "";

                stfGrid.innerHTML += `
                    <div class="modern-card">
                        <div class="card-content" style="padding-top: 1.5rem; display: flex; flex-direction: column; height: 100%;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <span class="tag tag-stf">ADI ${adi.numero || "S/N"}</span>
                                ${linkStfCard}
                            </div>
                            <h3 style="margin-top:10px;">${adi.titulo || "Sem Título"}</h3>
                            <p style="color:var(--text-muted); font-size:0.9rem;"><strong>Relator:</strong> ${adi.relator || "-"}</p>
                            <p style="color:var(--accent); font-size:0.9rem; margin-bottom:1rem;"><strong>Status:</strong> ${adi.status || "-"}</p>
                            <p style="line-height:1.6;">${resumo}</p>
                            <div style="margin-top:auto;">
                                <a href="#" class="read-more btn-abrir-modal-adi" data-id="${adi.id}">Ver Detalhes e Timeline <i class="ph ph-arrow-right"></i></a>
                            </div>
                        </div>
                    </div>`;
            });

            stfGrid.querySelectorAll(".btn-abrir-modal-adi").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    const idDaAdiClicada = btn.getAttribute("data-id");
                    const adi = cacheAdis[idDaAdiClicada];
                    if (!adi) return;
                    
                    const elNum = document.getElementById("modal-adi-numero"); if(elNum) elNum.textContent = `ADI ${adi.numero || ""}`;
                    const elTit = document.getElementById("modal-adi-titulo"); if(elTit) elTit.textContent = adi.titulo || "";
                    const elRel = document.getElementById("modal-adi-relator"); if(elRel) elRel.textContent = adi.relator || "";
                    const elStat = document.getElementById("modal-adi-status"); if(elStat) elStat.textContent = adi.status || "";
                    const elAnalise = document.getElementById("modal-adi-analise"); if(elAnalise) elAnalise.textContent = adi.analise || "";
                    const elAut = document.getElementById("modal-adi-autor"); if(elAut) elAut.textContent = adi.autorNome || "";
                    const elInst = document.getElementById("modal-adi-inst"); if(elInst) elInst.textContent = adi.autorInstituicao || "";
                    
                    const btnLinkStf = document.getElementById("modal-adi-linkbtn");
                    if (btnLinkStf) {
                        if (adi.linkSTF) { btnLinkStf.href = adi.linkSTF; btnLinkStf.style.display = "inline-flex"; } 
                        else { btnLinkStf.style.display = "none"; }
                    }

                    const painelRequerentes = document.getElementById("painel-requerentes");
                    const painelAmicus = document.getElementById("painel-amicus");
                    const painelDispositivos = document.getElementById("painel-dispositivos");

                    if (painelRequerentes) painelRequerentes.style.display = "none"; 
                    if (painelAmicus) painelAmicus.style.display = "none";
                    if (painelDispositivos) painelDispositivos.style.display = "none";

                    const btnToggleReq = document.getElementById("btn-toggle-requerentes");
                    if (btnToggleReq) {
                        const novoBtnToggle = btnToggleReq.cloneNode(true);
                        btnToggleReq.parentNode.replaceChild(novoBtnToggle, btnToggleReq);
                        novoBtnToggle.addEventListener("click", () => {
                            if (painelAmicus) painelAmicus.style.display = "none";
                            if (painelDispositivos) painelDispositivos.style.display = "none";
                            if (painelRequerentes && painelRequerentes.style.display === "none") {
                                painelRequerentes.style.display = "block";
                                const ul = document.getElementById("lista-requerentes");
                                const renderListaReq = () => {
                                    if(!ul) return;
                                    ul.innerHTML = "";
                                    if (adi.proponentes && adi.proponentes.length > 0) {
                                        adi.proponentes.forEach(p => {
                                            ul.innerHTML += `<li style="background: var(--white); padding: 10px 15px; border-radius: 6px; border-left: 4px solid var(--accent); box-shadow: 0 2px 4px rgba(0,0,0,0.02);"><strong style="color: var(--text-dark);">${p.nome}</strong><br><span style="font-size: 0.85rem; color: var(--text-muted);">${p.tipo}</span></li>`;
                                        });
                                    } else {
                                        ul.innerHTML = "<li><span style='color: var(--text-muted);'>Nenhum requerente encontrado.</span></li>";
                                    }
                                };
                                const contagemTipos = {};
                                if (adi.proponentes && adi.proponentes.length > 0) {
                                    adi.proponentes.forEach(p => { contagemTipos[p.tipo] = (contagemTipos[p.tipo] || 0) + 1; });
                                }
                                if (graficoRequerentesInstance) graficoRequerentesInstance.destroy();
                                const canvasReq = document.getElementById('grafico-requerentes');
                                if (canvasReq && Object.keys(contagemTipos).length > 0) {
                                    if (typeof Chart !== 'undefined') {
                                        graficoRequerentesInstance = new Chart(canvasReq, {
                                            type: 'doughnut',
                                            data: { labels: Object.keys(contagemTipos), datasets: [{ data: Object.values(contagemTipos), backgroundColor: ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#14b8a6', '#f97316'], borderWidth: 0 }] },
                                            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } } }
                                        });
                                    }
                                }
                                renderListaReq();
                            } else if (painelRequerentes) { painelRequerentes.style.display = "none"; }
                        });
                    }

                    const btnToggleAmicus = document.getElementById("btn-toggle-amicus");
                    if (btnToggleAmicus) {
                        const novoBtnAmicus = btnToggleAmicus.cloneNode(true);
                        btnToggleAmicus.parentNode.replaceChild(novoBtnAmicus, btnToggleAmicus);
                        novoBtnAmicus.addEventListener("click", () => {
                            if (painelRequerentes) painelRequerentes.style.display = "none";
                            if (painelDispositivos) painelDispositivos.style.display = "none";
                            if (painelAmicus && painelAmicus.style.display === "none") {
                                painelAmicus.style.display = "block";
                                const ul = document.getElementById("lista-amicus");
                                const renderListaAmi = () => {
                                    if(!ul) return;
                                    ul.innerHTML = "";
                                    if (adi.amicus && adi.amicus.length > 0) {
                                        adi.amicus.forEach(a => {
                                            const posStr = a.posicao ? String(a.posicao) : "";
                                            let corBorda = posStr.includes("Contra") ? "#10b981" : (posStr.includes("A favor") ? "#ef4444" : "#94a3b8");
                                            ul.innerHTML += `<li style="background: var(--white); padding: 10px 15px; border-radius: 6px; border-left: 4px solid ${corBorda}; box-shadow: 0 2px 4px rgba(0,0,0,0.02);"><strong style="color: var(--text-dark);">${a.nome}</strong><br><span style="font-size: 0.8rem; color: var(--text-muted);">${a.tipo} | <strong>Posição:</strong> ${posStr}</span></li>`;
                                        });
                                    } else {
                                        ul.innerHTML = "<li><span style='color: var(--text-muted);'>Nenhum Amicus Curiae encontrado.</span></li>";
                                    }
                                };
                                const contagemTipos = {}; const contagemPos = {};
                                if (adi.amicus && adi.amicus.length > 0) {
                                    adi.amicus.forEach(a => {
                                        contagemTipos[a.tipo] = (contagemTipos[a.tipo] || 0) + 1;
                                        contagemPos[a.posicao] = (contagemPos[a.posicao] || 0) + 1;
                                    });
                                }
                                if (graficoAmicusTipoInstance) graficoAmicusTipoInstance.destroy();
                                const canvasAmiTipo = document.getElementById('grafico-amicus-tipo');
                                if (canvasAmiTipo && Object.keys(contagemTipos).length > 0 && typeof Chart !== 'undefined') {
                                    graficoAmicusTipoInstance = new Chart(canvasAmiTipo, {
                                        type: 'pie',
                                        data: { labels: Object.keys(contagemTipos), datasets: [{ data: Object.values(contagemTipos), backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b'], borderWidth: 0 }] },
                                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } } }
                                    });
                                }
                                if (graficoAmicusPosInstance) graficoAmicusPosInstance.destroy();
                                const canvasAmiPos = document.getElementById('grafico-amicus-pos');
                                if (canvasAmiPos && Object.keys(contagemPos).length > 0 && typeof Chart !== 'undefined') {
                                    const bgColorsPos = Object.keys(contagemPos).map(posicao => posicao.includes("Contra") ? '#10b981' : (posicao.includes("A favor") ? '#ef4444' : '#94a3b8'));
                                    graficoAmicusPosInstance = new Chart(canvasAmiPos, {
                                        type: 'doughnut',
                                        data: { labels: Object.keys(contagemPos), datasets: [{ data: Object.values(contagemPos), backgroundColor: bgColorsPos, borderWidth: 0 }] },
                                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } } }
                                    });
                                }
                                renderListaAmi();
                            } else if (painelAmicus) { painelAmicus.style.display = "none"; }
                        });
                    }

                    const btnToggleDisp = document.getElementById("btn-toggle-dispositivos");
                    if (btnToggleDisp) {
                        const novoBtnDisp = btnToggleDisp.cloneNode(true);
                        btnToggleDisp.parentNode.replaceChild(novoBtnDisp, btnToggleDisp);
                        novoBtnDisp.addEventListener("click", () => {
                            if (painelRequerentes) painelRequerentes.style.display = "none";
                            if (painelAmicus) painelAmicus.style.display = "none";
                            if (painelDispositivos && painelDispositivos.style.display === "none") {
                                painelDispositivos.style.display = "block";
                                const ul = document.getElementById("lista-dispositivos");
                                const renderListaDisp = () => {
                                    if(!ul) return;
                                    ul.innerHTML = "";
                                    if (adi.dispositivos && adi.dispositivos.length > 0) {
                                        adi.dispositivos.forEach(d => {
                                            const statusStr = d.status ? String(d.status) : "";
                                            let corStatus = statusStr.includes("Inconstitucional") ? "#ef4444" : (statusStr.includes("Constitucional") ? "#10b981" : (statusStr.includes("Conforme") ? "#f59e0b" : "#94a3b8"));
                                            ul.innerHTML += `
                                                <li style="background: var(--white); padding: 15px; border-radius: 6px; border-left: 4px solid ${corStatus}; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                                                    <strong style="color: var(--text-dark); display: block; margin-bottom: 5px;">${d.texto}</strong>
                                                    <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 8px;"><strong>Justificativa:</strong> ${d.justificativa}</p>
                                                    <span class="tag" style="background: ${corStatus}15; color: ${corStatus}; padding: 4px 10px; font-size: 0.8rem; border: 1px solid ${corStatus}40;">${statusStr}</span>
                                                </li>
                                            `;
                                        });
                                    } else {
                                        ul.innerHTML = "<li><span style='color: var(--text-muted);'>Nenhum dispositivo encontrado.</span></li>";
                                    }
                                };
                                renderListaDisp();
                            } else if (painelDispositivos) { painelDispositivos.style.display = "none"; }
                        });
                    }

                    const sidebarPrincipios = document.getElementById("modal-adi-principios-preview");
                    if (sidebarPrincipios) {
                        sidebarPrincipios.innerHTML = "";
                        if (adi.principios && adi.principios.length > 0) {
                            const previewListP = adi.principios.slice(0, 2); 
                            previewListP.forEach(prin => {
                                sidebarPrincipios.innerHTML += `
                                    <div style="background: var(--white); border-left: 3px solid #86198f; padding: 0.8rem; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); margin-bottom: 8px;">
                                        <p style="font-size: 0.85rem; color: var(--text-dark); margin-bottom: 3px; font-weight: 500;">${prin.nome}</p>
                                        <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Invocado por: ${prin.ator}</p>
                                    </div>
                                `;
                            });
                            if (adi.principios.length > 2) {
                                sidebarPrincipios.innerHTML += `<p style="font-size: 0.75rem; color: var(--text-muted); text-align: center; margin: 5px 0;">+ ${adi.principios.length - 2} registo(s) oculto(s)</p>`;
                            }
                            sidebarPrincipios.innerHTML += `<button id="btn-abrir-painel-principios" class="btn-primary" style="width: 100%; padding: 8px; font-size: 0.85rem; margin-top: 10px; background: #86198f; border: none;">Ver Mapeamento Completo</button>`;
                            setTimeout(() => {
                                const btnAbrirPrin = document.getElementById("btn-abrir-painel-principios");
                                if (btnAbrirPrin) {
                                    btnAbrirPrin.addEventListener("click", () => {
                                        const modalPrin = document.getElementById("principios-modal");
                                        if (modalPrin) {
                                            modalPrin.classList.remove("hidden");
                                            const ul = document.getElementById("lista-principios-completa");
                                            if(ul) {
                                                ul.innerHTML = "";
                                                adi.principios.forEach(prin => {
                                                    ul.innerHTML += `
                                                        <li style="background: var(--white); border-left: 4px solid #86198f; padding: 1rem; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.03);">
                                                            <span class="tag" style="background: #faf5ff; color: #86198f; padding: 2px 8px; font-size: 0.7rem; margin-bottom: 8px;">Usado em: ${prin.documento}</span>
                                                            <p style="font-size: 0.95rem; color: var(--text-dark); margin-bottom: 5px; font-weight: 500;">"${prin.nome}"</p>
                                                            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;"><i class="ph ph-user"></i> Invocado por: ${prin.ator}</p>
                                                            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; font-style: italic;"><i class="ph ph-text-align-left"></i> ${prin.aplicacao}</p>
                                                        </li>
                                                    `;
                                                });
                                            }
                                        }
                                    });
                                }
                            }, 10);
                        } else { sidebarPrincipios.innerHTML = "<p style='color: var(--text-muted); font-size: 0.85rem;'>Nenhum princípio registado.</p>"; }
                    }

                    const sidebarDoutrinas = document.getElementById("modal-adi-doutrinas-preview");
                    if (sidebarDoutrinas) {
                        sidebarDoutrinas.innerHTML = "";
                        if (adi.doutrinas && adi.doutrinas.length > 0) {
                            const previewList = adi.doutrinas.slice(0, 2); 
                            previewList.forEach(dou => {
                                sidebarDoutrinas.innerHTML += `
                                    <div style="background: var(--white); border-left: 3px solid #be185d; padding: 0.8rem; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); margin-bottom: 8px;">
                                        <p style="font-size: 0.85rem; color: var(--text-dark); margin-bottom: 3px; font-weight: 500;">${dou.autor}</p>
                                        <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${dou.conceito}</p>
                                    </div>
                                `;
                            });
                            if (adi.doutrinas.length > 2) {
                                sidebarDoutrinas.innerHTML += `<p style="font-size: 0.75rem; color: var(--text-muted); text-align: center; margin: 5px 0;">+ ${adi.doutrinas.length - 2} registo(s) oculto(s)</p>`;
                            }
                            sidebarDoutrinas.innerHTML += `<button id="btn-abrir-painel-doutrinas" class="btn-primary" style="width: 100%; padding: 8px; font-size: 0.85rem; margin-top: 10px; background: #be185d; border: none;">Ver Mapeamento Completo</button>`;
                            setTimeout(() => {
                                const btnAbrirDou = document.getElementById("btn-abrir-painel-doutrinas");
                                if (btnAbrirDou) {
                                    btnAbrirDou.addEventListener("click", () => {
                                        const modalDou = document.getElementById("doutrinas-modal");
                                        if (modalDou) {
                                            modalDou.classList.remove("hidden");
                                            const ul = document.getElementById("lista-doutrinas-completa");
                                            if(ul) {
                                                ul.innerHTML = "";
                                                adi.doutrinas.forEach(dou => {
                                                    ul.innerHTML += `
                                                        <li style="background: var(--white); border-left: 4px solid #be185d; padding: 1rem; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.03);">
                                                            <span class="tag" style="background: #fdf4ff; color: #be185d; padding: 2px 8px; font-size: 0.7rem; margin-bottom: 8px;">Usado em: ${dou.documento}</span>
                                                            <p style="font-size: 0.95rem; color: var(--text-dark); margin-bottom: 5px; font-weight: 500;">"${dou.conceito}"</p>
                                                            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;"><i class="ph ph-user"></i> ${dou.autor}</p>
                                                            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; font-style: italic;"><i class="ph ph-book-open"></i> ${dou.obra}</p>
                                                        </li>
                                                    `;
                                                });
                                            }
                                        }
                                    });
                                }
                            }, 10);
                        } else { sidebarDoutrinas.innerHTML = "<p style='color: var(--text-muted); font-size: 0.85rem;'>Nenhum mapeamento de doutrina registado.</p>"; }
                    }

                    const sidebarConstitucionais = document.getElementById("modal-adi-constitucionais-preview");
                    if (sidebarConstitucionais) {
                        sidebarConstitucionais.innerHTML = "";
                        if (adi.constitucionais && adi.constitucionais.length > 0) {
                            const previewListC = adi.constitucionais.slice(0, 2); 
                            previewListC.forEach(con => {
                                sidebarConstitucionais.innerHTML += `
                                    <div style="background: var(--white); border-left: 3px solid #0e7490; padding: 0.8rem; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); margin-bottom: 8px;">
                                        <p style="font-size: 0.85rem; color: var(--text-dark); margin-bottom: 3px; font-weight: 500;">${con.dispositivo}</p>
                                        <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Invocado por: ${con.ator}</p>
                                    </div>
                                `;
                            });
                            if (adi.constitucionais.length > 2) {
                                sidebarConstitucionais.innerHTML += `<p style="font-size: 0.75rem; color: var(--text-muted); text-align: center; margin: 5px 0;">+ ${adi.constitucionais.length - 2} registo(s) oculto(s)</p>`;
                            }
                            sidebarConstitucionais.innerHTML += `<button id="btn-abrir-painel-constitucionais" class="btn-primary" style="width: 100%; padding: 8px; font-size: 0.85rem; margin-top: 10px; background: #0e7490; border: none;">Ver Mapeamento Completo</button>`;
                            setTimeout(() => {
                                const btnAbrirConst = document.getElementById("btn-abrir-painel-constitucionais");
                                if (btnAbrirConst) {
                                    btnAbrirConst.addEventListener("click", () => {
                                        const modalConst = document.getElementById("constitucionais-modal");
                                        if (modalConst) {
                                            modalConst.classList.remove("hidden");
                                            const ul = document.getElementById("lista-constitucionais-completa");
                                            if(ul) {
                                                ul.innerHTML = "";
                                                adi.constitucionais.forEach(con => {
                                                    ul.innerHTML += `
                                                        <li style="background: var(--white); border-left: 4px solid #0e7490; padding: 1rem; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.03);">
                                                            <span class="tag" style="background: #ecfeff; color: #0e7490; padding: 2px 8px; font-size: 0.7rem; margin-bottom: 8px;">Usado em: ${con.documento}</span>
                                                            <p style="font-size: 0.95rem; color: var(--text-dark); margin-bottom: 5px; font-weight: 500;">"${con.dispositivo}"</p>
                                                            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;"><i class="ph ph-user"></i> Invocado por: ${con.ator}</p>
                                                            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; font-style: italic;"><i class="ph ph-text-align-left"></i> ${con.fundamento}</p>
                                                        </li>
                                                    `;
                                                });
                                            }
                                        }
                                    });
                                }
                            }, 10);
                        } else { sidebarConstitucionais.innerHTML = "<p style='color: var(--text-muted); font-size: 0.85rem;'>Nenhum dispositivo constitucional registado.</p>"; }
                    }

                    const timelineContainer = document.getElementById("modal-adi-timeline");
                    if (timelineContainer) {
                        timelineContainer.innerHTML = ""; 
                        if (adi.movimentacoes && adi.movimentacoes.length > 0) {
                            const movsOrdenadas = [...adi.movimentacoes].sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
                            movsOrdenadas.forEach(mov => {
                                const dataFormatada = mov.data ? mov.data.split('-').reverse().join('/') : "Data não informada";
                                let linkHtml = mov.arquivo ? `<a href="${mov.arquivo}" target="_blank" class="timeline-attachment"><i class="ph ph-file-pdf"></i> Ver Anexo</a>` : "";
                                let videoHtml = mov.linkExterno ? `<a href="${mov.linkExterno}" target="_blank" class="timeline-attachment" style="background: #fdf2f8; color: #db2777; margin-left: 8px;"><i class="ph ph-link"></i> Acessar Link</a>` : "";
                                
                                let acoesHtml = "";
                                if (currentUserEmail === adi.autorEmail) {
                                    acoesHtml = `<div style="margin-top: 12px; display: flex; gap: 8px;"><button class="btn-action-edit btn-edit-mov-item" data-adi-id="${idDaAdiClicada}" data-mov-id="${mov.dataRegistro}"><i class="ph ph-pencil-simple"></i> Editar</button><button class="btn-action-delete btn-del-mov-item" data-adi-id="${idDaAdiClicada}" data-mov-id="${mov.dataRegistro}"><i class="ph ph-trash"></i> Excluir</button></div>`;
                                }
                                timelineContainer.innerHTML += `<div class="timeline-item"><span class="timeline-date">${dataFormatada}</span><div class="timeline-content"><p>${mov.descricao}</p><div>${linkHtml}${videoHtml}</div>${acoesHtml}</div></div>`;
                            });

                            timelineContainer.querySelectorAll(".btn-del-mov-item").forEach(btnDel => {
                                btnDel.addEventListener("click", async (ev) => {
                                    const movExata = adi.movimentacoes.find(m => m.dataRegistro === btnDel.getAttribute("data-mov-id"));
                                    if (movExata && confirm("Deseja excluir permanentemente?")) {
                                        await updateDoc(doc(db, "adis", btnDel.getAttribute("data-adi-id")), { movimentacoes: arrayRemove(movExata) });
                                        ev.target.closest('.timeline-item').remove();
                                    }
                                });
                            });
                            timelineContainer.querySelectorAll(".btn-edit-mov-item").forEach(btnEdit => {
                                btnEdit.addEventListener("click", () => {
                                    const movExata = adi.movimentacoes.find(m => m.dataRegistro === btnEdit.getAttribute("data-mov-id"));
                                    if (movExata && formMovimento) {
                                        idParaMovimentacao = btnEdit.getAttribute("data-adi-id"); 
                                        colecaoMovimentacao = "adis";
                                        formMovimento.dataset.mode = "edit"; 
                                        formMovimento.dataset.movId = movExata.dataRegistro; 
                                        formMovimento.dataset.oldArquivo = movExata.arquivo || "";
                                        
                                        const dEl = document.getElementById("mov-data"); if(dEl) dEl.value = movExata.data || ""; 
                                        const descEl = document.getElementById("mov-descricao"); if(descEl) descEl.value = movExata.descricao || "";
                                        const linkEl = document.getElementById("mov-link-externo"); if(linkEl) linkEl.value = movExata.linkExterno || "";
                                        
                                        const tEl = document.getElementById("titulo-modal-mov"); if(tEl) tEl.textContent = "Editar Andamento"; 
                                        const bEl = document.getElementById("btn-submit-mov"); if(bEl) bEl.textContent = "Salvar Alterações"; 
                                        const hEl = document.getElementById("mov-arquivo-help"); if(hEl) hEl.style.display = "block";
                                        if(modalMovimento) modalMovimento.classList.remove("hidden");
                                    }
                                });
                            });
                        } else { timelineContainer.innerHTML = "<p style='color:var(--text-muted); font-size:0.9rem;'>Nenhum andamento registrado ainda.</p>"; }
                    }
                    if (modalAdi) {
                        modalAdi.classList.remove("hidden"); 
                        document.body.style.overflow = "hidden"; 
                    }
                });
            });
        };

        if (inputBuscaGeral) inputBuscaGeral.addEventListener("input", renderAdis);
        if (inputFiltroRelator) inputFiltroRelator.addEventListener("input", renderAdis);
        if (inputFiltroRequerente) inputFiltroRequerente.addEventListener("input", renderAdis);

        onSnapshot(query(collection(db, "adis"), orderBy("createdAt", "desc")), (snapshot) => {
            todasAdis = [];
            cacheAdis = {};
            if (snapshot.empty) {
                stfGrid.innerHTML = "<p style='grid-column: 1/-1;text-align:center;'>Nenhuma ADI.</p>";
                return;
            }
            snapshot.forEach((docSnap) => {
                const adi = docSnap.data();
                adi.id = docSnap.id;
                todasAdis.push(adi);
                cacheAdis[docSnap.id] = adi;
            });
            renderAdis();
        }, (error) => {
            console.error("Erro ao carregar ADIs:", error);
            if (stfGrid) stfGrid.innerHTML = `<p style='grid-column: 1/-1;text-align:center;color:#ef4444;'>Erro ao carregar análises.<br><span style="font-size:0.8rem;color:var(--text-muted);">${error.message}</span></p>`;
        });
    }

    if (congressoGrid) {
        onSnapshot(query(collection(db, "congresso"), orderBy("createdAt", "desc")), (snapshot) => {
            let todosProjetos = [];
            if (!congressoGrid) return;
            congressoGrid.innerHTML = "";
            
            if (snapshot.empty) {
                congressoGrid.innerHTML = "<p style='grid-column: 1/-1;text-align:center;'>Nenhum projeto legislativo mapeado.</p>";
                return;
            }

            snapshot.forEach((docSnap) => {
                const proj = docSnap.data();
                proj.id = docSnap.id;
                todosProjetos.push(proj);
                
                let resumo = (proj.analise || "").substring(0, 100) + "...";
                let corStatus = proj.regime === "Urgência" ? "#ef4444" : "#db2777";

                congressoGrid.innerHTML += `
                    <div class="modern-card congresso-card">
                        <div class="card-content" style="padding-top: 1.5rem; display: flex; flex-direction: column; height: 100%;">
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <span class="tag tag-congresso">${proj.tipo || ""} ${proj.numero || ""}</span>
                                <span class="tag" style="background: ${corStatus}15; color: ${corStatus}; border: 1px solid ${corStatus}40;">${proj.regime || ""}</span>
                            </div>
                            <h3 style="margin-top:10px; font-size: 1.1rem;">${proj.ementa ? proj.ementa.substring(0, 80) + '...' : 'Sem ementa'}</h3>
                            <p style="color:var(--text-muted); font-size:0.9rem; margin: 0;"><strong>Relator:</strong> ${proj.relator || "-"}</p>
                            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem;"><strong>Status:</strong> ${proj.status || "-"}</p>
                            <div style="margin-top:auto;">
                                <a href="#" class="read-more btn-abrir-modal-cong" data-id="${proj.id}" style="color: #db2777;">Análise de Impacto <i class="ph ph-arrow-right"></i></a>
                            </div>
                        </div>
                    </div>`;
            });

            congressoGrid.querySelectorAll(".btn-abrir-modal-cong").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    const idDaProj = btn.getAttribute("data-id");
                    const proj = todosProjetos.find(p => p.id === idDaProj);
                    if (!proj) return;
                    
                    const elTip = document.getElementById("modal-cong-tipo"); if(elTip) elTip.textContent = proj.tipo || "";
                    const elNum = document.getElementById("modal-cong-numero"); if(elNum) elNum.textContent = `${proj.tipo || ""} ${proj.numero || ""}`;
                    const elEme = document.getElementById("modal-cong-ementa"); if(elEme) elEme.textContent = proj.ementa || "";
                    const elAut = document.getElementById("modal-cong-autor"); if(elAut) elAut.textContent = `${proj.autor || ""} (${proj.partido || ""})`;
                    const elCas = document.getElementById("modal-cong-casa"); if(elCas) elCas.textContent = proj.casa || "";
                    const elCom = document.getElementById("modal-cong-comissao"); if(elCom) elCom.textContent = proj.comissao || "";
                    const elRel = document.getElementById("modal-cong-relator"); if(elRel) elRel.textContent = proj.relator || "";
                    const elPos = document.getElementById("modal-cong-posicao"); if(elPos) elPos.textContent = proj.posicaoRelator || "";
                    const elAna = document.getElementById("modal-cong-analise"); if(elAna) elAna.textContent = proj.analise || "";
                    
                    const elRegime = document.getElementById("modal-cong-regime");
                    if (elRegime) {
                        elRegime.textContent = `Regime: ${proj.regime || ""}`;
                        elRegime.style.color = proj.regime === "Urgência" ? "#dc2626" : "#475569";
                        elRegime.style.background = proj.regime === "Urgência" ? "#fee2e2" : "#f1f5f9";
                    }

                    const btnLinkCong = document.getElementById("modal-cong-linkbtn");
                    if (btnLinkCong) {
                        if (proj.linkOficial) { btnLinkCong.href = proj.linkOficial; btnLinkCong.style.display = "inline-flex"; } 
                        else { btnLinkCong.style.display = "none"; }
                    }

                    const boxInstitutos = document.getElementById("modal-cong-institutos");
                    if (boxInstitutos) {
                        boxInstitutos.innerHTML = "";
                        if (proj.institutos && proj.institutos.length > 0) {
                            proj.institutos.forEach(inst => {
                                boxInstitutos.innerHTML += `<span class="tag" style="background: #fdf4ff; color: #be185d; border: 1px solid #fbcfe8;"><i class="ph ph-check-circle"></i> ${inst}</span>`;
                            });
                        }
                    }

                    const ulNormas = document.getElementById("modal-cong-normas");
                    if (ulNormas) {
                        ulNormas.innerHTML = "";
                        if (proj.normas && proj.normas.length > 0) {
                            proj.normas.forEach(n => {
                                ulNormas.innerHTML += `<li style="background: #fff; padding: 10px 15px; border-radius: 6px; border-left: 3px solid #db2777; box-shadow: 0 1px 3px rgba(0,0,0,0.05);"><strong style="color: var(--text-dark);">${n.norma}</strong><br><span style="font-size: 0.9rem; color: var(--text-muted);">${n.impacto}</span></li>`;
                            });
                        }
                    }

                    const boxAtores = document.getElementById("modal-cong-atores");
                    if (boxAtores) {
                        boxAtores.innerHTML = "";
                        if (proj.atores && proj.atores.length > 0) {
                            proj.atores.forEach(ator => {
                                const posStr = ator.posicao ? String(ator.posicao) : "";
                                let corBorda = posStr.includes("A favor") ? "#10b981" : (posStr.includes("Oposição") ? "#ef4444" : "#64748b");
                                boxAtores.innerHTML += `
                                    <div style="background: var(--white); border-left: 3px solid ${corBorda}; padding: 0.8rem; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                                        <p style="font-size: 0.85rem; color: var(--text-dark); margin-bottom: 3px; font-weight: 600;">${ator.nome || "Ator não identificado"}</p>
                                        <span class="tag" style="background: ${corBorda}15; color: ${corBorda}; font-size: 0.7rem; padding: 2px 6px;">${posStr}</span>
                                        ${ator.nota ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px; font-style: italic;">"${ator.nota}"</p>` : ''}
                                    </div>
                                `;
                            });
                        } else {
                            boxAtores.innerHTML = "<p style='color: var(--text-muted); font-size: 0.85rem;'>Nenhum lobby mapeado.</p>";
                        }
                    }

                    const boxTrechos = document.getElementById("modal-cong-trechos");
                    if (boxTrechos) {
                        boxTrechos.innerHTML = "";
                        if (proj.trechos && proj.trechos.length > 0) {
                            proj.trechos.forEach((t, index) => {
                                const div = document.createElement("div");
                                div.style = "background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02);";
                                div.innerHTML = `
                                    <div style="padding: 1.5rem; background: #f8faf9; border-bottom: 1px solid #e2e8f0;">
                                        <p style="font-family: monospace; font-size: 1rem; color: #334155; line-height: 1.6; white-space: pre-wrap; margin: 0;">${t.texto}</p>
                                    </div>
                                    <div style="padding: 1rem 1.5rem; display: flex; justify-content: flex-end; background: #fff;">
                                        <button class="btn-toggle-comentario" data-index="${index}" style="background: #fce7f3; color: #db2777; border: 1px solid #fbcfe8; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;"><i class="ph ph-chat-text" style="font-size: 1.2rem;"></i> Ver Comentário</button>
                                    </div>
                                    <div class="comentario-content" id="comentario-${index}" style="display: none; padding: 1.5rem; background: #fff; border-top: 1px dashed #e2e8f0;">
                                        <p style="margin: 0; color: var(--text-dark); line-height: 1.8; font-size: 1.05rem;"><strong><i class="ph ph-user-circle"></i> Análise:</strong><br>${t.comentario}</p>
                                    </div>
                                `;
                                boxTrechos.appendChild(div);
                            });

                            boxTrechos.querySelectorAll('.btn-toggle-comentario').forEach(btn => {
                                btn.addEventListener('click', function() {
                                    const idx = this.getAttribute('data-index');
                                    const content = document.getElementById(`comentario-${idx}`);
                                    if (content.style.display === "none") {
                                        content.style.display = "block";
                                        this.innerHTML = '<i class="ph ph-eye-slash" style="font-size: 1.2rem;"></i> Ocultar Comentário';
                                        this.style.background = '#f3f4f6';
                                        this.style.color = '#475569';
                                        this.style.borderColor = '#cbd5e1';
                                    } else {
                                        content.style.display = "none";
                                        this.innerHTML = '<i class="ph ph-chat-text" style="font-size: 1.2rem;"></i> Ver Comentário';
                                        this.style.background = '#fce7f3';
                                        this.style.color = '#db2777';
                                        this.style.borderColor = '#fbcfe8';
                                    }
                                });
                            });
                        } else {
                            boxTrechos.innerHTML = "<p style='color: var(--text-muted); font-size: 0.95rem; text-align: center; width: 100%; padding: 2rem 0;'>Nenhum trecho em destaque registado pelo pesquisador.</p>";
                        }
                    }

                    const timelineCongContainer = document.getElementById("modal-cong-timeline");
                    if (timelineCongContainer) {
                        timelineCongContainer.innerHTML = ""; 
                        if (proj.movimentacoes && proj.movimentacoes.length > 0) {
                            const movsOrdenadas = [...proj.movimentacoes].sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
                            movsOrdenadas.forEach(mov => {
                                const dataFormatada = mov.data ? mov.data.split('-').reverse().join('/') : "Data não informada";
                                let linkHtml = mov.arquivo ? `<a href="${mov.arquivo}" target="_blank" class="timeline-attachment"><i class="ph ph-file-pdf"></i> Ver Anexo</a>` : "";
                                let videoHtml = mov.linkExterno ? `<a href="${mov.linkExterno}" target="_blank" class="timeline-attachment" style="background: #fdf2f8; color: #db2777; margin-left: 8px;"><i class="ph ph-link"></i> Acessar Link</a>` : "";
                                
                                let acoesHtml = "";
                                if (currentUserEmail === proj.autorEmail) {
                                    acoesHtml = `<div style="margin-top: 12px; display: flex; gap: 8px;"><button class="btn-action-edit btn-edit-mov-item-cong" data-proj-id="${idDaProj}" data-mov-id="${mov.dataRegistro}"><i class="ph ph-pencil-simple"></i> Editar</button><button class="btn-action-delete btn-del-mov-item-cong" data-proj-id="${idDaProj}" data-mov-id="${mov.dataRegistro}"><i class="ph ph-trash"></i> Excluir</button></div>`;
                                }
                                timelineCongContainer.innerHTML += `<div class="timeline-item"><span class="timeline-date" style="color: #db2777;">${dataFormatada}</span><div class="timeline-content"><p>${mov.descricao}</p><div>${linkHtml}${videoHtml}</div>${acoesHtml}</div></div>`;
                            });

                            timelineCongContainer.querySelectorAll(".btn-del-mov-item-cong").forEach(btnDel => {
                                btnDel.addEventListener("click", async (ev) => {
                                    const movExata = proj.movimentacoes.find(m => m.dataRegistro === btnDel.getAttribute("data-mov-id"));
                                    if (movExata && confirm("Deseja excluir permanentemente?")) {
                                        await updateDoc(doc(db, "congresso", btnDel.getAttribute("data-proj-id")), { movimentacoes: arrayRemove(movExata) });
                                        ev.target.closest('.timeline-item').remove();
                                    }
                                });
                            });
                            
                            timelineCongContainer.querySelectorAll(".btn-edit-mov-item-cong").forEach(btnEdit => {
                                btnEdit.addEventListener("click", () => {
                                    const movExata = proj.movimentacoes.find(m => m.dataRegistro === btnEdit.getAttribute("data-mov-id"));
                                    if (movExata && formMovimento) {
                                        idParaMovimentacao = btnEdit.getAttribute("data-proj-id"); 
                                        colecaoMovimentacao = "congresso";
                                        
                                        formMovimento.dataset.mode = "edit"; 
                                        formMovimento.dataset.movId = movExata.dataRegistro; 
                                        formMovimento.dataset.oldArquivo = movExata.arquivo || "";
                                        
                                        const dEl = document.getElementById("mov-data"); if(dEl) dEl.value = movExata.data || ""; 
                                        const descEl = document.getElementById("mov-descricao"); if(descEl) descEl.value = movExata.descricao || "";
                                        const linkEl = document.getElementById("mov-link-externo"); if(linkEl) linkEl.value = movExata.linkExterno || "";
                                        
                                        const tEl = document.getElementById("titulo-modal-mov"); if(tEl) tEl.textContent = "Editar Andamento Legislativo"; 
                                        const bEl = document.getElementById("btn-submit-mov"); if(bEl) bEl.textContent = "Salvar Alterações"; 
                                        const hEl = document.getElementById("mov-arquivo-help"); if(hEl) hEl.style.display = "block";
                                        if(modalMovimento) modalMovimento.classList.remove("hidden");
                                    }
                                });
                            });
                        } else { timelineCongContainer.innerHTML = "<p style='color:var(--text-muted); font-size:0.9rem;'>Nenhum andamento registrado ainda.</p>"; }
                    }

                    if (modalCongresso) {
                        modalCongresso.classList.remove("hidden"); 
                        document.body.style.overflow = "hidden";
                    }
                });
            });
        }, (error) => {
            console.error("Erro ao carregar Congresso:", error);
            if (congressoGrid) congressoGrid.innerHTML = `<p style='grid-column: 1/-1;text-align:center;color:#ef4444;'>Erro ao carregar dados do congresso.<br><span style="font-size:0.8rem;color:var(--text-muted);">${error.message}</span></p>`;
        });
    }

    const btnBuscarStf = document.getElementById("btn-buscar-stf");
    if (btnBuscarStf) {
        btnBuscarStf.addEventListener("click", async () => {
            const linkInput = document.getElementById("adi-link");
            if (!linkInput || !linkInput.value || !linkInput.value.includes("stf.jus.br")) {
                return alert("Por favor, cole um link válido do portal do STF.");
            }
            const btnOriginalText = btnBuscarStf.innerHTML;
            btnBuscarStf.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Extraindo...';
            btnBuscarStf.disabled = true;

            try {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(linkInput.value)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Falha na comunicação com o proxy.');
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");

                let numero = "";
                const h3 = doc.querySelector("h3");
                const h2 = doc.querySelector("h2");
                if (h3 && h3.textContent.includes("AÇÃO DIRETA")) numero = h3.textContent.replace("AÇÃO DIRETA DE INCONSTITUCIONALIDADE", "").trim();
                else if (h2) numero = h2.textContent.replace(/\D/g, "");

                let relator = "";
                const dts = doc.querySelectorAll("dt");
                for (let dt of dts) {
                    if (dt.textContent.trim().includes("Relator:")) {
                        relator = dt.nextElementSibling ? dt.nextElementSibling.textContent.trim() : "";
                        break;
                    }
                }
                const statusEl = doc.querySelector(".item-status");
                const status = statusEl ? statusEl.textContent.trim() : "Em tramitação";

                const numEl = document.getElementById("adi-numero"); if (numEl && numero) numEl.value = numero;
                const relEl = document.getElementById("adi-relator"); if (relEl && relator) relEl.value = relator;
                const statEl = document.getElementById("adi-status"); if (statEl && status) statEl.value = status;
            } catch (error) {
                console.error("Erro na extração:", error);
                alert("O sistema anti-robôs do STF bloqueou a leitura no momento. Preencha manualmente.");
            } finally {
                btnBuscarStf.innerHTML = btnOriginalText;
                btnBuscarStf.disabled = false;
            }
        });
    }

    const btnBuscarCong = document.getElementById("btn-buscar-cong");
    if (btnBuscarCong) {
        btnBuscarCong.addEventListener("click", async () => {
            const tipoEl = document.getElementById("cong-tipo");
            const numAnoEl = document.getElementById("cong-numero");
            if (!tipoEl || !tipoEl.value) return alert("Por favor, selecione o Tipo (PL, PEC, etc.) antes de buscar.");
            if (!numAnoEl || !numAnoEl.value.includes("/")) return alert("Por favor, digite o Número e o Ano no formato correto (Ex: 2159/2021).");
            
            const [numero, ano] = numAnoEl.value.split("/");
            const tipo = tipoEl.value;
            const btnOriginalText = btnBuscarCong.innerHTML;
            btnBuscarCong.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Consultando...';
            btnBuscarCong.disabled = true;

            try {
                const urlBusca = `https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=${tipo}&numero=${numero}&ano=${ano}`;
                const resBusca = await fetch(urlBusca);
                const jsonBusca = await resBusca.json();

                if (!jsonBusca.dados || jsonBusca.dados.length === 0) throw new Error("Projeto não encontrado na base oficial.");

                const propBase = jsonBusca.dados[0];
                const idProp = propBase.id;

                const [resDetalhes, resAutores] = await Promise.all([
                    fetch(`https://dadosabertos.camara.leg.br/api/v2/proposicoes/${idProp}`),
                    fetch(`https://dadosabertos.camara.leg.br/api/v2/proposicoes/${idProp}/autores`)
                ]);
                
                const jsonDetalhes = await resDetalhes.json();
                const jsonAutores = await resAutores.json();
                const detalhes = jsonDetalhes.dados;

                const ementaEl = document.getElementById("cong-ementa"); if (ementaEl) ementaEl.value = detalhes.ementa || propBase.ementa;
                const linkEl = document.getElementById("cong-link"); if (linkEl) linkEl.value = `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${idProp}`;
                const casaEl = document.getElementById("cong-casa"); if (casaEl) casaEl.value = "Câmara dos Deputados";

                if (detalhes.statusProposicao) {
                    const status = detalhes.statusProposicao;
                    const statEl = document.getElementById("cong-status"); if (statEl && status.descricaoTramitacao) statEl.value = status.descricaoTramitacao;
                    const comissaoEl = document.getElementById("cong-comissao"); if (comissaoEl && status.siglaOrgao) comissaoEl.value = status.siglaOrgao;
                    const regimeEl = document.getElementById("cong-regime");
                    if (regimeEl && status.regime) {
                        const regLower = status.regime.toLowerCase();
                        if (regLower.includes("urgência")) regimeEl.value = "Urgência";
                        else if (regLower.includes("prioridade")) regimeEl.value = "Prioridade";
                        else regimeEl.value = "Ordinário";
                    }
                }

                if (jsonAutores.dados && jsonAutores.dados.length > 0) {
                    const autorPrincipal = jsonAutores.dados[0];
                    const autorEl = document.getElementById("cong-autor"); if (autorEl) autorEl.value = autorPrincipal.nome;
                    const partidoEl = document.getElementById("cong-partido");
                    if (partidoEl) {
                        if (autorPrincipal.siglaPartido && autorPrincipal.siglaUf) partidoEl.value = `${autorPrincipal.siglaPartido}/${autorPrincipal.siglaUf}`;
                        else if (autorPrincipal.nome.includes("Poder Executivo")) partidoEl.value = "Poder Executivo";
                        else partidoEl.value = "Outros";
                    }
                }
                
                btnBuscarCong.innerHTML = '<i class="ph ph-check"></i> Preenchido!';
                setTimeout(() => { btnBuscarCong.innerHTML = btnOriginalText; btnBuscarCong.disabled = false; }, 2000);
            } catch (error) {
                console.error("Erro na API:", error);
                alert(error.message);
                btnBuscarCong.innerHTML = btnOriginalText;
                btnBuscarCong.disabled = false;
            }
        });
    }
});