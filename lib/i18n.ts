import type { WidgetLanguage } from "@/lib/types";

export const copy = {
  en: {
    title: "Reserve a table",
    subtitle: "Send your request and the restaurant will confirm availability.",
    name: "Name",
    phone: "Phone",
    email: "Email",
    date: "Date",
    time: "Time",
    partySize: "Guests",
    namePlaceholder: "Your full name",
    phonePlaceholder: "912 345 678",
    emailPlaceholder: "you@example.com",
    today: "Today",
    tomorrow: "Tomorrow",
    nextWeekend: "Weekend",
    selectDate: "Choose a date",
    selectTime: "Choose a time",
    nextSevenDays: "Next 7 days",
    previousWeek: "Previous 7 days",
    nextWeek: "Next 7 days",
    noTimes: "No reservation times available for this date.",
    specialRequests: "Special requests",
    specialRequestsPlaceholder: "Allergies, occasion, seating preference...",
    marketingConsent:
      "I agree to receive promotional offers and updates from the restaurant (email, SMS, WhatsApp).",
    privacyPrefix: "I have read and accept the",
    privacyPolicy: "Privacy Policy",
    terms: "Terms",
    submit: "Send reservation request",
    submitting: "Sending request...",
    required: "Required",
    disabled: "Online reservation requests are currently unavailable.",
    notFound: "Reservation widget not found.",
    configMissing: "Reservation widget is not configured yet.",
    success:
      "Your reservation request has been received. It is not confirmed yet. The restaurant will review it and contact you shortly.",
    error:
      "This time may not be available. Please choose another time or contact the restaurant directly.",
    invalidEmail: "Enter a valid email address.",
    minGuests: "Guests must be at least {count}.",
    privacyRequired: "Please accept the Privacy Policy to continue.",
    successTitle: "Request received",
    successNote: "You will receive a confirmation from the restaurant shortly."
  },
  pt: {
    title: "Reservar mesa",
    subtitle: "Envie o pedido e o restaurante confirmará a disponibilidade.",
    name: "Nome",
    phone: "Telefone",
    email: "Email",
    date: "Data",
    time: "Hora",
    partySize: "Pessoas",
    namePlaceholder: "O seu nome completo",
    phonePlaceholder: "912 345 678",
    emailPlaceholder: "nome@email.com",
    today: "Hoje",
    tomorrow: "Amanhã",
    nextWeekend: "Fim sem.",
    selectDate: "Escolher data",
    selectTime: "Escolher hora",
    nextSevenDays: "Próximos 7 dias",
    previousWeek: "7 dias anteriores",
    nextWeek: "Próximos 7 dias",
    noTimes: "Sem horários de reserva disponíveis para esta data.",
    specialRequests: "Pedidos especiais",
    specialRequestsPlaceholder: "Alergias, ocasião, preferência de mesa...",
    marketingConsent:
      "Aceito receber ofertas e novidades do restaurante (email, SMS, WhatsApp).",
    privacyPrefix: "Li e aceito a",
    privacyPolicy: "Política de Privacidade",
    terms: "Termos",
    submit: "Enviar pedido de reserva",
    submitting: "A enviar pedido...",
    required: "Obrigatório",
    disabled: "Os pedidos de reserva online estão temporariamente indisponíveis.",
    notFound: "Widget de reservas não encontrado.",
    configMissing: "O widget de reservas ainda não está configurado.",
    success:
      "Recebemos o seu pedido de reserva. A reserva ainda não está confirmada. O restaurante irá analisar o pedido e contactá-lo em breve.",
    error:
      "Este horário poderá não estar disponível. Por favor escolha outro horário ou contacte diretamente o restaurante.",
    invalidEmail: "Introduza um email válido.",
    minGuests: "O número de pessoas deve ser pelo menos {count}.",
    privacyRequired: "Aceite a Política de Privacidade para continuar.",
    successTitle: "Pedido recebido",
    successNote: "Receberá uma confirmação do restaurante em breve."
  },
  zh: {
    title: "预订餐桌",
    subtitle: "提交预订请求后，餐厅会确认是否有位。",
    name: "姓名",
    phone: "电话",
    email: "邮箱",
    date: "日期",
    time: "时间",
    partySize: "人数",
    namePlaceholder: "您的姓名",
    phonePlaceholder: "912 345 678",
    emailPlaceholder: "you@example.com",
    today: "今天",
    tomorrow: "明天",
    nextWeekend: "周末",
    selectDate: "选择日期",
    selectTime: "选择时间",
    nextSevenDays: "未来 7 天",
    previousWeek: "前 7 天",
    nextWeek: "后 7 天",
    noTimes: "该日期暂无可预订时间。",
    specialRequests: "特殊要求",
    specialRequestsPlaceholder: "过敏、纪念日、座位偏好...",
    marketingConsent: "我同意接收餐厅优惠和更新（邮箱、短信、WhatsApp）。",
    privacyPrefix: "我已阅读并接受",
    privacyPolicy: "隐私政策",
    terms: "条款",
    submit: "发送预订请求",
    submitting: "正在发送...",
    required: "必填",
    disabled: "目前无法在线提交预订请求。",
    notFound: "未找到预订组件。",
    configMissing: "预订组件尚未配置。",
    success: "我们已收到您的预订请求。预订尚未确认，餐厅会尽快联系您。",
    error: "该时间可能无法预订。请选择其他时间或直接联系餐厅。",
    invalidEmail: "请输入有效的邮箱地址。",
    minGuests: "人数至少为 {count}。",
    privacyRequired: "请接受隐私政策后继续。",
    successTitle: "请求已收到",
    successNote: "餐厅会尽快向您确认。"
  }
} satisfies Record<WidgetLanguage, Record<string, string>>;

export function normalizeLanguage(language: string | null | undefined): WidgetLanguage {
  const normalizedLanguage = language?.toLowerCase();

  if (normalizedLanguage?.startsWith("pt")) return "pt";
  if (
    normalizedLanguage?.startsWith("zh") ||
    normalizedLanguage?.startsWith("cn") ||
    normalizedLanguage?.includes("chinese")
  ) {
    return "zh";
  }

  return "en";
}
