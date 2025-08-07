import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Limpar dados existentes (apenas se as tabelas existirem)
  try {
    await prisma.product.deleteMany();
    await prisma.address.deleteMany();
    await prisma.user.deleteMany();
    await prisma.partner.deleteMany();
  } catch (error) {
    console.log('⚠️ Algumas tabelas não existem ainda (primeira execução)');
  }

  // Criar admin do sistema
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@ebrecho.com.br',
      password: adminPassword,
      name: 'Administrador',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin criado:', admin.email);

  // Criar 3 brechós com endereços (incluindo hasPhysicalStore)
  const partners = await Promise.all([
    // Brechó 1 - Brechó da Maria (com loja física)
    prisma.partner.create({
      data: {
        name: 'Brechó da Maria',
        email: 'contato@brechodamaria.com',
        phone: '(11) 98765-4321',
        document: '12345678000190',
        documentType: 'CNPJ',
        description: 'Especializado em roupas vintage e peças únicas dos anos 70 e 80',
        hasPhysicalStore: true,
        address: {
          create: {
            street: 'Rua das Flores',
            number: '123',
            complement: 'Loja 2',
            neighborhood: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234-567',
          },
        },
        users: {
          create: {
            email: 'maria@brechodamaria.com',
            password: await bcrypt.hash('senha123', 10),
            name: 'Maria Silva',
            role: 'PARTNER_ADMIN',
          },
        },
      },
    }),

    // Brechó 2 - Vintage Store (com loja física)
    prisma.partner.create({
      data: {
        name: 'Vintage Store',
        email: 'contato@vintagestore.com',
        phone: '(21) 99876-5432',
        document: '98765432000185',
        documentType: 'CNPJ',
        description: 'Moda sustentável com curadoria especial de peças de grife',
        hasPhysicalStore: true,
        address: {
          create: {
            street: 'Avenida Atlântica',
            number: '456',
            neighborhood: 'Copacabana',
            city: 'Rio de Janeiro',
            state: 'RJ',
            zipCode: '22070-001',
          },
        },
        users: {
          create: {
            email: 'joao@vintagestore.com',
            password: await bcrypt.hash('senha123', 10),
            name: 'João Santos',
            role: 'PARTNER_ADMIN',
          },
        },
      },
    }),

    // Brechó 3 - Eco Fashion (online-only, sem loja física)
    prisma.partner.create({
      data: {
        name: 'Eco Fashion',
        email: 'contato@ecofashion.com',
        phone: '(31) 91234-5678',
        document: '54367890123',
        documentType: 'CPF',
        description: 'Brechó online focado em moda consciente e sustentável - apenas vendas online',
        hasPhysicalStore: false,
        // Sem endereço para este parceiro online-only
        users: {
          create: {
            email: 'ana@ecofashion.com',
            password: await bcrypt.hash('senha123', 10),
            name: 'Ana Costa',
            role: 'PARTNER_ADMIN',
          },
        },
      },
    }),

    // Brechó 4 - Online Store Brasil (online-only para demonstrar)
    prisma.partner.create({
      data: {
        name: 'Online Store Brasil',
        email: 'contato@onlinestorebrasil.com',
        phone: '(85) 99988-7766',
        document: '98765432109',
        documentType: 'CPF',
        description: 'Loja virtual especializada em moda urbana e streetwear',
        hasPhysicalStore: false,
        // Sem endereço para este parceiro online-only
        users: {
          create: {
            email: 'carlos@onlinestorebrasil.com',
            password: await bcrypt.hash('senha123', 10),
            name: 'Carlos Oliveira',
            role: 'PARTNER_ADMIN',
          },
        },
      },
    }),
  ]);

  console.log('✅ Brechós criados:', partners.map(p => p.name).join(', '));

  // Criar alguns produtos para cada brechó
  const products = await Promise.all([
    // Produtos do Brechó da Maria
    prisma.product.create({
      data: {
        name: 'Vestido Vintage Floral',
        description: 'Vestido midi dos anos 70 em perfeito estado, estampa floral exclusiva',
        price: 89.90,
        sku: 'BM001',
        category: 'Vestidos',
        brand: 'Vintage',
        size: 'M',
        color: 'Floral',
        condition: 'LIKE_NEW',
        status: 'AVAILABLE',
        images: {
          create: [{
            originalUrl: 'https://via.placeholder.com/400x600/FF6B6B/FFFFFF?text=Vestido+Vintage',
            processedUrl: 'https://via.placeholder.com/400x600/FF6B6B/FFFFFF?text=Vestido+Vintage',
            thumbnailUrl: 'https://via.placeholder.com/200x300/FF6B6B/FFFFFF?text=Vestido+Vintage',
            order: 0
          }]
        },
        partnerId: partners[0].id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Jaqueta Jeans Oversized',
        description: 'Jaqueta jeans clássica oversized, perfeita para looks despojados',
        price: 120.00,
        sku: 'BM002',
        category: 'Jaquetas',
        brand: 'Lee',
        size: 'G',
        color: 'Azul',
        condition: 'GOOD',
        status: 'AVAILABLE',
        images: {
          create: [{
            originalUrl: 'https://via.placeholder.com/400x600/4ECDC4/FFFFFF?text=Jaqueta+Jeans',
            processedUrl: 'https://via.placeholder.com/400x600/4ECDC4/FFFFFF?text=Jaqueta+Jeans',
            thumbnailUrl: 'https://via.placeholder.com/200x300/4ECDC4/FFFFFF?text=Jaqueta+Jeans',
            order: 0
          }]
        },
        partnerId: partners[0].id,
      },
    }),

    // Produtos da Vintage Store
    prisma.product.create({
      data: {
        name: 'Bolsa Chanel Classic',
        description: 'Bolsa Chanel Classic autêntica, couro matelassê, corrente dourada',
        price: 3500.00,
        sku: 'VS001',
        category: 'Bolsas',
        brand: 'Chanel',
        color: 'Preto',
        condition: 'GOOD',
        status: 'AVAILABLE',
        images: {
          create: [{
            originalUrl: 'https://via.placeholder.com/400x600/1A535C/FFFFFF?text=Bolsa+Chanel',
            processedUrl: 'https://via.placeholder.com/400x600/1A535C/FFFFFF?text=Bolsa+Chanel',
            thumbnailUrl: 'https://via.placeholder.com/200x300/1A535C/FFFFFF?text=Bolsa+Chanel',
            order: 0
          }]
        },
        partnerId: partners[1].id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Blazer Armani',
        description: 'Blazer Giorgio Armani em lã, corte italiano impecável',
        price: 890.00,
        sku: 'VS002',
        category: 'Blazers',
        brand: 'Giorgio Armani',
        size: 'P',
        color: 'Cinza',
        condition: 'LIKE_NEW',
        status: 'AVAILABLE',
        images: {
          create: [{
            originalUrl: 'https://via.placeholder.com/400x600/FFE66D/000000?text=Blazer+Armani',
            processedUrl: 'https://via.placeholder.com/400x600/FFE66D/000000?text=Blazer+Armani',
            thumbnailUrl: 'https://via.placeholder.com/200x300/FFE66D/000000?text=Blazer+Armani',
            order: 0
          }]
        },
        partnerId: partners[1].id,
      },
    }),

    // Produtos da Eco Fashion
    prisma.product.create({
      data: {
        name: 'Calça Wide Leg Linho',
        description: 'Calça wide leg em linho natural, confortável e sustentável',
        price: 150.00,
        sku: 'EF001',
        category: 'Calças',
        brand: 'Eco Brand',
        size: 'M',
        color: 'Bege',
        condition: 'NEW',
        status: 'AVAILABLE',
        images: {
          create: [{
            originalUrl: 'https://via.placeholder.com/400x600/A8E6CF/000000?text=Calça+Linho',
            processedUrl: 'https://via.placeholder.com/400x600/A8E6CF/000000?text=Calça+Linho',
            thumbnailUrl: 'https://via.placeholder.com/200x300/A8E6CF/000000?text=Calça+Linho',
            order: 0
          }]
        },
        partnerId: partners[2].id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Camisa Algodão Orgânico',
        description: 'Camisa em algodão orgânico certificado, produção ética',
        price: 95.00,
        sku: 'EF002',
        category: 'Camisas',
        brand: 'Sustainable Fashion',
        size: 'G',
        color: 'Branco',
        condition: 'NEW',
        status: 'AVAILABLE',
        images: {
          create: [{
            originalUrl: 'https://via.placeholder.com/400x600/FFD93D/000000?text=Camisa+Orgânica',
            processedUrl: 'https://via.placeholder.com/400x600/FFD93D/000000?text=Camisa+Orgânica',
            thumbnailUrl: 'https://via.placeholder.com/200x300/FFD93D/000000?text=Camisa+Orgânica',
            order: 0
          }]
        },
        partnerId: partners[2].id,
      },
    }),

    // Produtos da Online Store Brasil
    prisma.product.create({
      data: {
        name: 'Tênis Streetwear Limited',
        description: 'Tênis edição limitada para streetwear urbano',
        price: 280.00,
        sku: 'OSB001',
        category: 'Calçados',
        brand: 'Urban Brand',
        size: '42',
        color: 'Preto/Branco',
        condition: 'NEW',
        status: 'AVAILABLE',
        images: {
          create: [{
            originalUrl: 'https://via.placeholder.com/400x600/FF6B35/FFFFFF?text=Tênis+Street',
            processedUrl: 'https://via.placeholder.com/400x600/FF6B35/FFFFFF?text=Tênis+Street',
            thumbnailUrl: 'https://via.placeholder.com/200x300/FF6B35/FFFFFF?text=Tênis+Street',
            order: 0
          }]
        },
        partnerId: partners[3].id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Moletom Oversized Grafitti',
        description: 'Moletom oversized com arte graffiti exclusiva',
        price: 165.00,
        sku: 'OSB002',
        category: 'Moletons',
        brand: 'Street Art',
        size: 'GG',
        color: 'Cinza',
        condition: 'LIKE_NEW',
        status: 'AVAILABLE',
        images: {
          create: [{
            originalUrl: 'https://via.placeholder.com/400x600/6C5CE7/FFFFFF?text=Moletom+Graf',
            processedUrl: 'https://via.placeholder.com/400x600/6C5CE7/FFFFFF?text=Moletom+Graf',
            thumbnailUrl: 'https://via.placeholder.com/200x300/6C5CE7/FFFFFF?text=Moletom+Graf',
            order: 0
          }]
        },
        partnerId: partners[3].id,
      },
    }),
  ]);

  console.log('✅ Produtos criados:', products.length);

  // Criar alguns clientes e usuários de teste
  const customers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'cliente1@gmail.com',
        password: await bcrypt.hash('senha123', 10),
        name: 'Cliente Silva',
        role: 'CUSTOMER',
      },
    }),
    prisma.user.create({
      data: {
        email: 'cliente2@gmail.com',
        password: await bcrypt.hash('senha123', 10),
        name: 'Cliente Santos',
        role: 'CUSTOMER',
      },
    }),
    // Usuário PARTNER_ADMIN sem parceiro para testar o setup
    prisma.user.create({
      data: {
        email: 'teste@parceiro.com',
        password: await bcrypt.hash('senha123', 10),
        name: 'Teste Parceiro',
        role: 'PARTNER_ADMIN',
        emailVerified: true, // Já verificado para pular a verificação de email
      },
    }),
    // Outro usuário PARTNER_ADMIN para testar loja online
    prisma.user.create({
      data: {
        email: 'online@teste.com',
        password: await bcrypt.hash('senha123', 10),
        name: 'Loja Online Teste',
        role: 'PARTNER_ADMIN',
        emailVerified: true,
      },
    }),
  ]);

  console.log('✅ Clientes e usuários de teste criados:', customers.length);

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('\n📋 Dados de acesso:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👨‍💼 ADMIN:');
  console.log('   admin@ebrecho.com.br / admin123');
  console.log('');
  console.log('🏪 PARCEIROS COM LOJA FÍSICA:');
  console.log('   maria@brechodamaria.com / senha123 (Brechó da Maria)');
  console.log('   joao@vintagestore.com / senha123 (Vintage Store)');
  console.log('');
  console.log('💻 PARCEIROS ONLINE-ONLY:');
  console.log('   ana@ecofashion.com / senha123 (Eco Fashion)');
  console.log('   carlos@onlinestorebrasil.com / senha123 (Online Store Brasil)');
  console.log('');
  console.log('🧪 USUÁRIOS PARA TESTE DE SETUP:');
  console.log('   teste@parceiro.com / senha123 (sem parceiro - para testar loja física)');
  console.log('   online@teste.com / senha123 (sem parceiro - para testar online-only)');
  console.log('');
  console.log('👥 CLIENTES:');
  console.log('   cliente1@gmail.com / senha123');
  console.log('   cliente2@gmail.com / senha123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });