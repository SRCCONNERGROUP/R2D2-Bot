const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder 
} = require('discord.js');

require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 🔹 CANALES
const CHANNELS = {
    pagos: "1419772886188687411",
    obamacareBroker: "1419767454560944188",
    medicareBroker: "1419767387359809556",
    miembros: "1419774101605581031"
};

// 🔹 NOMBRES Y EMOJIS
const NAMES = {
    pagos: "💳 Pagos",
    obamacareBroker: "🏥 Obamacare Broker",
    medicareBroker: "🏥 Medicare Broker",
    miembros: "👤 Cuentas Miembros"
};

// 🔹 EMOJIS PARA SUBCATEGORÍAS
const SUBCATEGORY_EMOJIS = {
    "Obamacare": "🏥",
    "Medicare": "🏥",
    "Pago": "💳",
    "Cuenta": "👤",
    "Otros": "📄"
};

// 🔹 LINKS DINÁMICOS CON SUBCATEGORÍAS
let LINKS = {
    pagos: {},
    obamacareBroker: {},
    medicareBroker: {},
    miembros: {}
};

// 🔹 BOTONES PRINCIPALES
const CATEGORIAS = Object.keys(NAMES).map(k => ({
    label: NAMES[k],
    value: k,
    style: k.includes("Broker") ? ButtonStyle.Success : ButtonStyle.Primary
}));

// 🔹 FUNCION TRUNCADO DE LABELS
function truncateLabel(text, max = 50) {
    if (text.length <= max) return text;
    return text.slice(0, max - 3) + "...";
}

// 🔹 ACTUALIZAR LINKS DESDE CANALES
async function actualizarLinks() {
    try {
        for (const categoria of Object.keys(CHANNELS)) {
            const canal = await client.channels.fetch(CHANNELS[categoria]);
            const mensajes = await canal.messages.fetch({ limit: 50 });

            LINKS[categoria] = {};

            mensajes.forEach(m => {
                const match = m.content.match(/\[(.*?)\]/);
                const sub = match ? match[1] : "Otros";

                if (!LINKS[categoria][sub]) LINKS[categoria][sub] = [];
                LINKS[categoria][sub].push({ 
                    label: truncateLabel(`${SUBCATEGORY_EMOJIS[sub] || "📄"} ${m.content}`), 
                    url: m.content 
                });
            });
        }
        console.log("🔄 Links actualizados automáticamente con subcategorías y emojis.");
    } catch (error) {
        console.error("❌ Error al actualizar links:", error);
    }
}

// 🔹 EVENTO READY
client.once('ready', async () => {
    console.log(`✅ R2D2 en línea como ${client.user.tag}`);
    await actualizarLinks();
    setInterval(actualizarLinks, 300000); // cada 5 minutos
});

// 🔹 MENSAJE DE BIENVENIDA Y MENÚ PRINCIPAL
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.toLowerCase().includes("menu")) return;

    const botones = CATEGORIAS.map(cat => new ButtonBuilder()
        .setCustomId(`categoria_${cat.value}`)
        .setLabel(`🔹 ${cat.label}`)
        .setStyle(cat.style)
    );

    await message.reply({
        content: 
`👋 ¡Hola! Bienvenido al panel R2D2:
────────────────────────────
1️⃣ Selecciona una categoría
2️⃣ Selecciona un subcategoría (si aplica)
3️⃣ Selecciona el link → se enviará por DM
────────────────────────────`,
        components: [new ActionRowBuilder().addComponents(botones)]
    });
});

// 🔹 INTERACCIONES
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    try {
        // 🔹 Botón de categoría
        if (interaction.isButton() && interaction.customId.startsWith("categoria_")) {
            const categoria = interaction.customId.replace("categoria_", "");
            const subcats = Object.keys(LINKS[categoria]);

            // Si solo hay subcategoría "Otros", ir directo a links
            if (subcats.length === 1 && subcats[0] === "Otros") {
                const links = LINKS[categoria]["Otros"];

                if (!links || links.length === 0) {
                    return interaction.reply({ content: "⚠️ No hay links disponibles.", ephemeral: true });
                }

                const opciones = links.map((l, index) => ({
                    label: truncateLabel(l.label, 50),
                    value: `${categoria}|link_${index}`
                }));

                interaction.client._tempLinks = interaction.client._tempLinks || {};
                interaction.client._tempLinks[categoria] = {};
                links.forEach((l, index) => {
                    interaction.client._tempLinks[categoria][`link_${index}`] = l.url;
                });

                const menu = new StringSelectMenuBuilder()
                    .setCustomId("link_select")
                    .setPlaceholder("➡️ Selecciona un link")
                    .addOptions(opciones);

                return interaction.reply({
                    content: `🔗 **Links disponibles de ${NAMES[categoria]}:**`,
                    components: [new ActionRowBuilder().addComponents(menu)],
                    ephemeral: true
                });
            }

            // Si hay varias subcategorías → mostrar menú de subcategorías
            const opciones = subcats.map((s, i) => ({
                label: `${SUBCATEGORY_EMOJIS[s] || "📄"} | ${s}`,
                value: `${categoria}|subcat_${i}`
            }));

            interaction.client._tempSubcats = interaction.client._tempSubcats || {};
            interaction.client._tempSubcats[categoria] = {};
            subcats.forEach((s, i) => {
                interaction.client._tempSubcats[categoria][`subcat_${i}`] = s;
            });

            const menu = new StringSelectMenuBuilder()
                .setCustomId("subcategoria_select")
                .setPlaceholder("➡️ Selecciona una subcategoría")
                .addOptions(opciones);

            await interaction.reply({ 
                content: `📂 **Subcategorías disponibles de ${NAMES[categoria]}:**`,
                components: [new ActionRowBuilder().addComponents(menu)],
                ephemeral: true
            });
        }

        // 🔹 Subcategoría seleccionada
        if (interaction.isStringSelectMenu() && interaction.customId === "subcategoria_select") {
            const [categoria, subcatKey] = interaction.values[0].split("|");
            const subcat = interaction.client._tempSubcats?.[categoria]?.[subcatKey];
            const links = LINKS[categoria][subcat];

            if (!links || links.length === 0) {
                return interaction.update({
                    content: `⚠️ No hay links disponibles en **${subcat}**.`,
                    components: []
                });
            }

            const opciones = links.map((l, index) => ({
                label: truncateLabel(l.label, 50),
                value: `${categoria}|link_${index}`
            }));

            // Guardar la url real en un diccionario temporal
            interaction.client._tempLinks = interaction.client._tempLinks || {};
            interaction.client._tempLinks[categoria] = {};
            links.forEach((l, index) => {
                interaction.client._tempLinks[categoria][`link_${index}`] = l.url;
            });

            const menu = new StringSelectMenuBuilder()
                .setCustomId("link_select")
                .setPlaceholder("➡️ Selecciona un link")
                .addOptions(opciones);

            await interaction.update({
                content: `🔗 **Links disponibles en ${subcat}:**`,
                components: [new ActionRowBuilder().addComponents(menu)]
            });
        }

        // 🔹 Link final → enviado por DM
        if (interaction.isStringSelectMenu() && interaction.customId === "link_select") {
            const [categoria, tempKey] = interaction.values[0].split("|");
            const url = interaction.client._tempLinks?.[categoria]?.[tempKey];

            if (!url) return interaction.update({
                content: "❌ Error al recuperar el link. Intenta otra vez.",
                components: []
            });

            await interaction.user.send(`🔗 **R2D2 Link:** ${NAMES[categoria]}\n${url}`);
            await interaction.update({ content: "✅ Te envié el link por privado.", components: [] });
        }
    } catch (err) {
        console.error(err);
        if (!interaction.replied) interaction.reply({ content: "❌ Ocurrió un error al procesar tu solicitud.", ephemeral: true });
    }
});

require('dotenv').config();
client.login(process.env.DISCORD_TOKEN);

