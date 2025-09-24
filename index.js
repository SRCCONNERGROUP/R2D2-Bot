const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    EmbedBuilder,
    AttachmentBuilder
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
    miembros: "1419774101605581031",
    tutoriales: "1419784342338670592",
    documentos: "1419762991100072098"
};

// 🔹 NOMBRES Y EMOJIS
const NAMES = {
    pagos: "💳 Pagos",
    obamacareBroker: "🏥 Obamacare Broker",
    medicareBroker: "🏥 Medicare Broker",
    miembros: "👤 Cuentas Miembros",
    tutoriales: "🎬 Tutoriales",
    documentos: "📄 Documentos"
};

// 🔹 EMOJIS PARA SUBCATEGORÍAS
const SUBCATEGORY_EMOJIS = {
    "Obamacare": "🏥",
    "Medicare": "🏥",
    "Pago": "💳",
    "Cuenta": "👤",
    "Tutorial": "🎬",
    "Documento": "📄",
    "Otros": "📄"
};

// 🔹 LINKS DINÁMICOS CON SUBCATEGORÍAS
let LINKS = {
    pagos: {},
    obamacareBroker: {},
    medicareBroker: {},
    miembros: {},
    tutoriales: {},
    documentos: {}
};

// 🔹 BOTONES PRINCIPALES
const CATEGORIAS = Object.keys(NAMES).map(k => ({
    label: NAMES[k],
    value: k,
    style: k.includes("Broker") ? ButtonStyle.Success : ButtonStyle.Primary
}));

function truncateLabel(text, max = 40) {
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

                // Texto
                if (m.content) {
                    LINKS[categoria][sub].push({ 
                        label: truncateLabel(`${SUBCATEGORY_EMOJIS[sub] || "📄"} ${m.content}`), 
                        url: m.content,
                        type: "text"
                    });
                }

                // Archivos adjuntos
                m.attachments.forEach(att => {
                    LINKS[categoria][sub].push({
                        label: truncateLabel(`${SUBCATEGORY_EMOJIS[sub] || "📄"} ${att.name}`),
                        url: att.url,
                        type: att.contentType?.startsWith("video") ? "video" : "file",
                        name: att.name,
                        thumbnail: att.contentType?.startsWith("image") ? att.url : null
                    });
                });
            });
        }
        console.log("🔄 Links y archivos actualizados automáticamente con mini-previews.");
    } catch (error) {
        console.error("❌ Error al actualizar links:", error);
    }
}

// 🔹 EVENTO READY
client.once('ready', async () => {
    console.log(`✅ R2D2 en línea como ${client.user.tag}`);
    await actualizarLinks();
    setInterval(actualizarLinks, 300000);
});

// 🔹 MENSAJE DE BIENVENIDA
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.toLowerCase().includes("menu")) return;

    const botones = CATEGORIAS.map(cat => new ButtonBuilder()
        .setCustomId(`categoria_${cat.value}`)
        .setLabel(`🔹 ${cat.label}`)
        .setStyle(cat.style)
    );

    await message.reply({
        content: "👋 ¡Hola! Bienvenido al panel R2D2:\n────────────────────────────\nSelecciona una categoría para ver los links y archivos.\n────────────────────────────",
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

            if (subcats.length === 1 && subcats[0] === "Otros") {
                return enviarLinksPorDM(interaction, categoria, "Otros");
            }

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
                content: `📂 Subcategorías de ${NAMES[categoria]}:`,
                components: [new ActionRowBuilder().addComponents(menu)],
                ephemeral: true
            });
        }

        // 🔹 Subcategoría seleccionada
        if (interaction.isStringSelectMenu() && interaction.customId === "subcategoria_select") {
            const [categoria, subcatKey] = interaction.values[0].split("|");
            const subcat = interaction.client._tempSubcats?.[categoria]?.[subcatKey];
            return enviarLinksPorDM(interaction, categoria, subcat);
        }
    } catch (err) {
        console.error(err);
        if (!interaction.replied) interaction.reply({ content: "❌ Ocurrió un error.", ephemeral: true });
    }
});

// 🔹 FUNCION PARA ENVIAR LINKS POR DM CON EMBEDS VISUALES
async function enviarLinksPorDM(interaction, categoria, subcat) {
    const links = LINKS[categoria][subcat];
    if (!links || links.length === 0) return interaction.reply({ content: "⚠️ No hay links o archivos disponibles.", ephemeral: true });

    for (const item of links) {
        const embed = new EmbedBuilder()
            .setTitle(item.name || item.label)
            .setDescription(`Categoría: ${NAMES[categoria]}`)
            .setURL(item.url)
            .setColor(0x00AE86)
            .setFooter({ text: "R2D2 Bot" });

        if (item.thumbnail) embed.setThumbnail(item.thumbnail);

        if (item.type === "file") {
            const attachment = new AttachmentBuilder(item.url);
            await interaction.user.send({ embeds: [embed], files: [attachment] });
        } else {
            await interaction.user.send({ embeds: [embed] });
        }
    }

    await interaction.reply({ content: "✅ Te envié los links y archivos por DM.", components: [], ephemeral: true });
}

// 🔹 LOGIN
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

