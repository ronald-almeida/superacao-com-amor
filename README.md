# Checkout — Programa: Superação com Amor

Checkout responsivo e independente, com pagamento exclusivamente por **Pix de R$ 397,70**, usando a API Black Cat e sem banco de dados próprio.

## Publicação na Vercel

1. Importe este repositório para um projeto Vercel. Framework preset: **Other**; Root directory: raiz do repositório.
2. Em **Settings → Environment Variables**, crie `BLACKCAT_API_KEY` usando a sua chave do painel da Black Cat (Production e Preview, quando necessário). Nunca coloque a chave no HTML ou GitHub.
3. Faça o redeploy após salvar a variável.
4. Em produção, teste uma cobrança real com CPF válido autorizado para teste. Confira no painel Black Cat antes de transferir qualquer valor.

## Fluxo

`index.html` valida os dados do comprador. `POST /api/pix` valida novamente e gera uma transação fixa de `39770` centavos com `paymentMethod: pix`, item digital (`tangible:false`), nome/email/telefone/documento e UTM opcionais. O retorno é exibido no modal com QR Code e copia-e-cola. `GET /api/status?id=...` consulta o status da cobrança enquanto o modal está aberto. O valor **jamais** vem da entrada do cliente.

Endereço/CEP não é enviado à Black Cat para produtos digitais. Não há banco de dados, webhook, liberação automática de acesso nem emissão de recibo por e-mail. O comprador deverá receber o acesso pelo processo real do vendedor. Confirme a identidade do vendedor no gateway antes de divulgar o checkout.

### Cuidados

Sem persistência, cobranças anteriores não são recuperadas após fechar o navegador; não gere outra cobrança após falhas incertas sem verificar no painel Black Cat. O controle antifraude, throttling e antiflood adicional devem ser configurados no gateway/WAF da Vercel. Credenciais permanecem server-side.

Este site não é um checkout operado pela Hotmart e não usa o selo "Protegido por Hotmart" — atribuição que seria imprecisa com o processador Black Cat.

Documentação: https://docs.blackcatoficial.com/
