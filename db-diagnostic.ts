import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- DATABASE DIAGNOSTIC ---')
  try {
    const userCount = await prisma.user.count()
    console.log('Total Users:', userCount)

    const projectCount = await prisma.project.count()
    console.log('Total Projects:', projectCount)

    const publicationCount = await prisma.publication.count()
    console.log('Total Publications:', publicationCount)

    const taskCount = await prisma.task.count()
    console.log('Total Tasks:', taskCount)

    if (projectCount > 0) {
      const sampleProject = await prisma.project.findFirst({
        include: { teacher: true }
      })
      console.log('Sample Project:', {
        id: sampleProject?.id,
        title: sampleProject?.title,
        teacher: sampleProject?.teacher?.name
      })
    }
  } catch (error) {
    console.error('DIAGNOSTIC FAILED:', error)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
