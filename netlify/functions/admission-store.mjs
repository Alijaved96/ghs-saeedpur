import { getStore } from '@netlify/blobs'

export default {
  async formSubmitted(event) {
    const incoming = event?.data || {}
    const formName = incoming['form-name'] || incoming.form_name || ''

    if (formName && formName !== 'admission-enquiry') return
    if (!incoming.student_name || !incoming.class_applying) return

    const data = { ...incoming }
    delete data['form-name']
    delete data.form_name
    delete data['bot-field']

    const application = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: null,
      status: 'Pending',
      data,
    }

    const store = getStore({ name: 'admission-applications', consistency: 'strong' })
    await store.setJSON(application.id, application)
  },
}
