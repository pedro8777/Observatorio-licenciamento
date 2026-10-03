document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. BANCO DE DADOS GLOBAL DOS ESTADOS
    // ==========================================
    const dadosEstados = {
        "AC": { nome: "Acre", texto: "Atualizações do IMAC sobre licenciamento de atividades agrossilvipastoris e manejo florestal." },
        "AL": { nome: "Alagoas", texto: "Diretrizes do IMA/AL para licenciamento em áreas de proteção ambiental costeira." },
        "AP": { nome: "Amapá", texto: "Novas regras da SEMA para simplificação do licenciamento de pequeno impacto." },
        "AM": { nome: "Amazonas", texto: "Resoluções do CEMAAM sobre licenciamento de infraestrutura em áreas sensíveis da Amazônia." },
        "BA": { nome: "Bahia", texto: "Inema regulamenta novos procedimentos para empreendimentos de energia renovável (solar e eólica)." },
        "CE": { nome: "Ceará", texto: "Semace implementa sistema de licenciamento por adesão e compromisso (LAC) para atividades específicas." },
        "DF": { nome: "Distrito Federal", texto: "Brasília Ambiental atualiza normas sobre supressão vegetal no cerrado." },
        "ES": { nome: "Espírito Santo", texto: "IEMA revisa exigências de estudos de impacto para atividades portuárias." },
        "GO": { nome: "Goiás", texto: "Semad goiana foca na digitalização dos processos e licenças autodeclaratórias." },
        "MA": { nome: "Maranhão", texto: "SEMA estabelece novos critérios para o licenciamento na região do Matopiba." },
        "MT": { nome: "Mato Grosso", texto: "Sema-MT atualiza regulamentação do Cadastro Ambiental Rural (CAR) atrelado ao licenciamento." },
        "MS": { nome: "Mato Grosso do Sul", texto: "Imasul debate flexibilização do licenciamento para atividades agropecuárias." },
        "MG": { nome: "Minas Gerais", texto: "Copam altera deliberações normativas sobre o licenciamento de barragens de rejeitos minerários." },
        "PA": { nome: "Pará", texto: "Semas foca na rastreabilidade e licenciamento de atividades pecuárias e florestais." },
        "PB": { nome: "Paraíba", texto: "Sudema emite novas portarias sobre o controle de efluentes industriais." },
        "PR": { nome: "Paraná", texto: "IAT (Instituto Água e Terra) moderniza sistema SGA para emissão de licenças." },
        "PE": { nome: "Pernambuco", texto: "Diretrizes estaduais (CPRH) atualizadas para o licenciamento ambiental de empreendimentos do polo têxtil no Agreste." },
        "PI": { nome: "Piauí", texto: "Semar regulamenta novas frentes de licenciamento para o setor de energias limpas." },
        "RJ": { nome: "Rio de Janeiro", texto: "INEA adota novas regras de simplificação para atividades de baixo impacto ambiental." },
        "RN": { nome: "Rio Grande do Norte", texto: "Idema revisa normas para licenciamento de parques eólicos onshore e offshore." },
        "RS": { nome: "Rio Grande do Sul", texto: "Fepam atualiza diretrizes de licenciamento considerando adaptação a eventos climáticos extremos." },
        "RO": { nome: "Rondônia", texto: "Sedam simplifica procedimentos para atividades de agricultura familiar." },
        "RR": { nome: "Roraima", texto: "Femarh propõe novo enquadramento para atividades de mineração de pequeno porte." },
        "SC": { nome: "Santa Catarina", texto: "IMA-SC expande as modalidades de Licença Ambiental por Compromisso (LAC)." },
        "SP": { nome: "São Paulo", texto: "Cetesb e SMA preparam resoluções focadas na regulamentação estadual do mercado de carbono e avaliação de impactos sinérgicos." },
        "SE": { nome: "Sergipe", texto: "Adema foca na fiscalização e licenciamento de polos industriais e carcinicultura." },
        "TO": { nome: "Tocantins", texto: "Naturatins revisa termos de referência para estudos de impacto no agronegócio." }
    };

    // ==========================================
    // 2. LÓGICA DO MAPA INTERATIVO
    // ==========================================
    const elementosMapa = document.querySelectorAll("svg path, svg polygon");
    const infoCard = document.getElementById("info-estado");
    const tituloEstado = document.getElementById("estado-titulo");
    const textoEstado = document.getElementById("estado-texto");

    elementosMapa.forEach(elemento => {
        elemento.addEventListener("click", () => {
            let sigla = elemento.getAttribute("id"); 
            if (!sigla) return; 
            sigla = sigla.toUpperCase().trim();

            if (dadosEstados[sigla]) {
                tituloEstado.textContent = dadosEstados[sigla].nome;
                textoEstado.textContent = dadosEstados[sigla].texto;
            } else {
                tituloEstado.textContent = "Estado Selecionado (" + sigla + ")";
                textoEstado.textContent = "Ainda não há dados mapeados para este estado.";
            }
            infoCard.classList.remove("hidden");
        });
    });

    // ==========================================
    // 3. LÓGICA DE NAVEGAÇÃO DAS ABAS (COM SCROLL REFORÇADO)
    // ==========================================
    const links = document.querySelectorAll(".nav-links a:not(#btn-abrir-login):not(#btn-logout):not(.user-menu-btn)");
    const sections = document.querySelectorAll(".content-section");

    links.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            
            // 1. FORÇA O NAVEGADOR A SUBIR PARA O TOPO IMEDIATAMENTE DE FORMA SUAVE
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            links.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            const targetId = link.getAttribute("data-target");
            
            sections.forEach(s => {
                s.style.opacity = 0; 
                setTimeout(() => { s.classList.remove("active"); }, 300);
            });

            setTimeout(() => {
                const activeSection = document.getElementById(targetId);
                if(activeSection) {
                    activeSection.classList.add("active");
                    setTimeout(() => activeSection.style.opacity = 1, 50); 
                }
            }, 300);
        });
    });

    // ==========================================
    // 4. EFEITO GLASSMORPHISM NO HEADER
    // ==========================================
    const header = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // ==========================================
    // 5. LÓGICA DA BARRA DE PESQUISA DE ESTADOS
    // ==========================================
    const searchInput = document.getElementById("search-estado");

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const termoBusca = e.target.value.toLowerCase().trim();
            if (termoBusca === "") {
                infoCard.classList.add("hidden");
                return;
            }
            let estadoEncontrado = null;
            for (const sigla in dadosEstados) {
                if (dadosEstados[sigla].nome.toLowerCase().includes(termoBusca)) {
                    estadoEncontrado = dadosEstados[sigla];
                    break;
                }
            }
            if (estadoEncontrado) {
                tituloEstado.textContent = estadoEncontrado.nome;
                textoEstado.textContent = estadoEncontrado.texto;
                infoCard.classList.remove("hidden");
            } else {
                tituloEstado.textContent = "Busca não encontrada";
                textoEstado.textContent = "Verifique a ortografia do estado pesquisado.";
                infoCard.classList.remove("hidden");
            }
        });
    }

    // ==========================================
    // 6. LÓGICA DOS FILTROS DO CONGRESSO
    // ==========================================
    const filterBtns = document.querySelectorAll(".filter-btn");
    const congressoCards = document.querySelectorAll(".congresso-card");

    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const filterValue = btn.getAttribute("data-filter");

            congressoCards.forEach(card => {
                const cardStatus = card.getAttribute("data-status");
                if (filterValue === "todos" || filterValue === cardStatus) {
                    card.style.display = "block";
                    setTimeout(() => card.style.opacity = "1", 50);
                } else {
                    card.style.opacity = "0";
                    setTimeout(() => card.style.display = "none", 300);
                }
            });
        });
    });

    // ==========================================
    // 7. LÓGICA DA INTERFACE DO MODAL DE LOGIN
    // ==========================================
    const modalLogin = document.getElementById("login-modal");
    const btnAbrirLogin = document.getElementById("btn-abrir-login");
    const btnFecharLogin = document.getElementById("fechar-login");
    const linkToggle = document.getElementById("link-toggle");
    const tituloModal = document.getElementById("modal-titulo");
    const btnSubmit = document.getElementById("btn-submit-auth");
    const textoToggle = document.getElementById("texto-toggle");

    let isLoginMode = true;

    if (btnAbrirLogin) {
        btnAbrirLogin.addEventListener("click", (e) => {
            e.preventDefault();
            if (!btnAbrirLogin.classList.contains("logged-in")) {
                modalLogin.classList.remove("hidden");
            }
        });
    }

    if (btnFecharLogin) {
        btnFecharLogin.addEventListener("click", () => {
            modalLogin.classList.add("hidden");
        });
    }

    window.addEventListener("click", (e) => {
        if (e.target === modalLogin) {
            modalLogin.classList.add("hidden");
        }
    });

    if (linkToggle) {
        linkToggle.addEventListener("click", (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode; 

            if (isLoginMode) {
                tituloModal.textContent = "Acesso Restrito";
                btnSubmit.textContent = "Entrar";
                textoToggle.textContent = "Não tem uma conta?";
                linkToggle.textContent = "Cadastre-se";
            } else {
                tituloModal.textContent = "Criar Conta";
                btnSubmit.textContent = "Cadastrar";
                textoToggle.textContent = "Já tem uma conta?";
                linkToggle.textContent = "Faça Login";
            }
        });
    }

    // ==========================================
    // 8. WIDGET FLUTUANTE DE CONTATO
    // ==========================================
    const floatingBtn = document.getElementById("floating-contact-btn");
    const contactPopup = document.getElementById("contact-popup");
    const closePopupBtn = document.getElementById("close-popup");

    if (floatingBtn && contactPopup) {
        floatingBtn.addEventListener("click", () => {
            contactPopup.classList.toggle("show");
        });

        if (closePopupBtn) {
            closePopupBtn.addEventListener("click", () => {
                contactPopup.classList.remove("show");
            });
        }

        document.addEventListener("click", (e) => {
            if (!floatingBtn.contains(e.target) && !contactPopup.contains(e.target)) {
                contactPopup.classList.remove("show");
            }
        });
    }

    // ==========================================
    // 9. REDIRECIONAMENTO LIMPO (RODAPÉ E CARTÕES DA HOME)
    // ==========================================
    const atalhosNavegacao = document.querySelectorAll("[data-target]:not(.nav-links a)");

    atalhosNavegacao.forEach(atalho => {
        atalho.addEventListener("click", (e) => {
            e.preventDefault();
            
            // Garantia extra de scroll ao clicar num atalho
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            const destino = atalho.getAttribute("data-target");
            const linkMenuSuperior = document.querySelector(`.nav-links a[data-target="${destino}"]`);
            
            if (linkMenuSuperior) {
                linkMenuSuperior.click(); 
            }
        });
    });

    // ==========================================
    // 10. LÓGICA DO MENU MOBILE (HAMBÚRGUER)
    // ==========================================
    const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
    const navLinksContainer = document.getElementById("nav-links");
    
    if (mobileMenuToggle && navLinksContainer) {
        // Alterna entre abrir e fechar o menu
        mobileMenuToggle.addEventListener("click", () => {
            navLinksContainer.classList.toggle("nav-active");
            
            // Troca o ícone de 'lista' para 'X'
            const icon = mobileMenuToggle.querySelector("i");
            if (navLinksContainer.classList.contains("nav-active")) {
                icon.classList.remove("ph-list");
                icon.classList.add("ph-x");
            } else {
                icon.classList.remove("ph-x");
                icon.classList.add("ph-list");
            }
        });

        // Fecha o menu sozinho quando o utilizador clica num link (comportamento SPA)
        const linksMobile = navLinksContainer.querySelectorAll("a");
        linksMobile.forEach(link => {
            link.addEventListener("click", () => {
                navLinksContainer.classList.remove("nav-active");
                const icon = mobileMenuToggle.querySelector("i");
                if(icon) {
                    icon.classList.remove("ph-x");
                    icon.classList.add("ph-list");
                }
            });
        });
    }

  // ==========================================
    // 11. RADAR DE NOTÍCIAS (Automação Google News)
    // ==========================================
    const newsContainer = document.getElementById("news-container");
    
    if (newsContainer) {
        // Use termos objetivos separados por OR sem aspas extras na query
        const query = encodeURIComponent('"vorcaro" OR "lei geral do licenciamento ambiental" OR "ADI 7919" OR "Lei nº 15.190/2025"');
        
        // Mantém a consulta limpa para o Google News RSS
        const googleRss = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
        
        // API de conversão RSS para JSON
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(googleRss)}`;

        fetch(apiUrl)
            .then(response => {
                if (!response.ok) throw new Error("Erro de conexão na requisição");
                return response.json();
            })
            .then(data => {
                // Valida se retornou com sucesso e com itens
                if (data.status === "ok" && Array.isArray(data.items) && data.items.length > 0) {
                    newsContainer.innerHTML = ""; // Limpa a mensagem de carregamento
                    
                    // Pega até 3 notícias
                    const topNews = data.items.slice(0, 3);
                    
                    topNews.forEach(item => {
                        let titleParts = item.title.split(" - ");
                        let source = titleParts.length > 1 ? titleParts.pop() : "Portal Jurídico";
                        let cleanTitle = titleParts.join(" - ");
                        
                        let pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
                        let dataFormatada = pubDate.toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', year: 'numeric' });

                        const newsCard = document.createElement("a");
                        newsCard.href = item.link;
                        newsCard.target = "_blank";
                        newsCard.rel = "noopener noreferrer";
                        newsCard.className = "news-card";
                        
                        newsCard.innerHTML = `
                            <span class="news-source">${source}</span>
                            <h4 class="news-title">${cleanTitle}</h4>
                            <span class="news-date"><i class="ph ph-calendar-blank"></i> ${dataFormatada}</span>
                        `;
                        
                        newsContainer.appendChild(newsCard);
                    });
                } else {
                    console.warn("Resposta da API de notícias sem itens:", data);
                    newsContainer.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: var(--text-muted);'>Nenhuma notícia recente encontrada no momento.</p>";
                }
            })
            .catch(error => {
                console.error("Erro ao buscar notícias:", error);
                newsContainer.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: #ef4444;'>A ligação ao portal de notícias falhou. Tente novamente mais tarde.</p>";
            });
    }
});