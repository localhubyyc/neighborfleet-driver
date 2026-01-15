#!/usr/bin/env python3
"""
LocalFirst YYC - Receipt Generator
Creates PDF receipts for customers and kitchen/store
"""

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch, mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from datetime import datetime
import os

# Receipt dimensions (80mm thermal printer width)
THERMAL_WIDTH = 80 * mm
THERMAL_HEIGHT = 200 * mm  # Variable, will extend

class ReceiptGenerator:
    """Generate PDF receipts for LocalFirst YYC"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._create_custom_styles()
    
    def _create_custom_styles(self):
        """Create custom paragraph styles"""
        self.styles.add(ParagraphStyle(
            'ReceiptTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            alignment=TA_CENTER,
            spaceAfter=6,
            textColor=colors.HexColor('#25D366')
        ))
        
        self.styles.add(ParagraphStyle(
            'ReceiptSubtitle',
            parent=self.styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER,
            textColor=colors.grey
        ))
        
        self.styles.add(ParagraphStyle(
            'StoryText',
            parent=self.styles['Normal'],
            fontSize=9,
            alignment=TA_LEFT,
            textColor=colors.HexColor('#444444'),
            leading=12,
            spaceBefore=6,
            spaceAfter=6
        ))
        
        self.styles.add(ParagraphStyle(
            'ItemName',
            parent=self.styles['Normal'],
            fontSize=11,
            alignment=TA_LEFT
        ))
        
        self.styles.add(ParagraphStyle(
            'SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#25D366'),
            spaceBefore=12,
            spaceAfter=6
        ))

    def generate_customer_receipt(self, order_data, output_path):
        """
        Generate customer receipt with story and PHOTOS
        """
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=0.5*inch,
            bottomMargin=0.5*inch
        )
        
        story = []
        
        # Header
        story.append(Paragraph("🍕 LocalFirst YYC", self.styles['ReceiptTitle']))
        story.append(Paragraph("Support Local. Eat Amazing.", self.styles['ReceiptSubtitle']))
        story.append(Spacer(1, 12))
        
        # Order info
        story.append(Paragraph(f"<b>Order #{order_data.get('order_number', 'N/A')}</b>", self.styles['Normal']))
        story.append(Paragraph(
            datetime.fromisoformat(order_data.get('created_at', datetime.now().isoformat())).strftime('%B %d, %Y at %I:%M %p'),
            self.styles['ReceiptSubtitle']
        ))
        story.append(Spacer(1, 12))
        
        # Horizontal line
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#25D366')))
        story.append(Spacer(1, 12))
        
        # Customer info
        story.append(Paragraph("📋 <b>DELIVERY DETAILS</b>", self.styles['SectionHeader']))
        story.append(Paragraph(f"<b>{order_data.get('customer_name', 'Guest')}</b>", self.styles['Normal']))
        story.append(Paragraph(f"📱 {self._format_phone(order_data.get('customer_phone', ''))}", self.styles['Normal']))
        story.append(Paragraph(f"📍 {order_data.get('customer_address', 'N/A')}", self.styles['Normal']))
        story.append(Spacer(1, 12))
        
        # Restaurant info
        story.append(Paragraph(f"🍽️ <b>FROM: {order_data.get('restaurant_name', 'Restaurant')}</b>", self.styles['SectionHeader']))
        story.append(Spacer(1, 6))
        
        # Order items table
        items_data = [['Item', 'Qty', 'Price']]
        for item in order_data.get('items', []):
            items_data.append([
                item.get('name', 'Item'),
                str(item.get('quantity', 1)),
                f"${item.get('price', 0):.2f}"
            ])
        
        items_table = Table(items_data, colWidths=[4*inch, 0.5*inch, 1*inch])
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f0f0f0')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#333333')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 12))
        
        # Totals
        subtotal = order_data.get('subtotal', 0)
        discount = order_data.get('discount', 0)
        delivery_fee = order_data.get('delivery_fee', 0)
        tip = order_data.get('tip', 0)
        total = order_data.get('total', subtotal)
        
        totals_data = [
            ['Subtotal', f"${subtotal:.2f}"],
        ]
        
        if discount > 0:
            discount_type = order_data.get('discount_type', 'Discount')
            if discount_type == 'first_order':
                totals_data.append(['🎉 First Order (10% OFF)', f"-${discount:.2f}"])
            else:
                totals_data.append([f'Discount', f"-${discount:.2f}"])
        
        if delivery_fee > 0:
            totals_data.append(['Delivery Fee', f"${delivery_fee:.2f}"])
        else:
            totals_data.append(['Delivery', 'FREE'])
        
        if tip > 0:
            totals_data.append(['Driver Tip', f"${tip:.2f}"])
        
        totals_data.append(['', ''])  # Spacer row
        totals_data.append(['TOTAL', f"${total:.2f}"])
        
        totals_table = Table(totals_data, colWidths=[4.5*inch, 1*inch])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTSIZE', (0, 0), (-1, -2), 10),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, -1), (-1, -1), 14),
            ('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor('#25D366')),
            ('TOPPADDING', (0, -1), (-1, -1), 8),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor('#25D366')),
        ]))
        story.append(totals_table)
        story.append(Spacer(1, 12))
        
        # Payment method
        payment_method = order_data.get('payment_method', 'card')
        payment_display = {
            'cash': '💵 Cash on Delivery',
            'visa': '💳 Visa',
            'mastercard': '💳 Mastercard',
            'debit': '🏦 Debit Card',
            'amex': '💳 American Express'
        }.get(payment_method, '💳 Card')
        
        story.append(Paragraph(f"<b>Payment:</b> {payment_display}", self.styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Horizontal line
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#25D366')))
        story.append(Spacer(1, 12))
        
        # THE STORY SECTION - This is what makes LocalFirst special!
        story.append(Paragraph("💚 <b>YOUR IMPACT TODAY</b>", self.styles['SectionHeader']))
        story.append(Spacer(1, 10))
        
        # Restaurant owner story WITH PHOTO
        owner = order_data.get('restaurant_owner', {})
        if owner:
            owner_image_path = owner.get('image', '')
            owner_name = owner.get('name', 'the Owner')
            owner_story = owner.get('story', 'Thank you for supporting our local restaurant!')
            
            # Create owner card with photo
            if owner_image_path and os.path.exists(owner_image_path):
                try:
                    owner_img = Image(owner_image_path, width=1.2*inch, height=1.2*inch)
                    owner_img.hAlign = 'LEFT'
                    
                    owner_text = f'''<b>👩‍🍳 Meet {owner_name}</b><br/><br/>
                    <i>"{owner_story}"</i>'''
                    
                    owner_data = [[owner_img, Paragraph(owner_text, self.styles['StoryText'])]]
                    
                    owner_table = Table(owner_data, colWidths=[1.4*inch, 4.1*inch])
                    owner_table.setStyle(TableStyle([
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('LEFTPADDING', (1, 0), (1, 0), 12),
                        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff8f0')),
                        ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#e07020')),
                        ('TOPPADDING', (0, 0), (-1, -1), 10),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                        ('LEFTPADDING', (0, 0), (0, 0), 10),
                        ('RIGHTPADDING', (-1, 0), (-1, 0), 10),
                    ]))
                    story.append(owner_table)
                except Exception as e:
                    print(f"Error loading owner image: {e}")
                    story.append(Paragraph(f"<b>👩‍🍳 Meet {owner_name}</b>", self.styles['Normal']))
                    story.append(Paragraph(f"<i>\"{owner_story}\"</i>", self.styles['StoryText']))
            else:
                story.append(Paragraph(f"<b>👩‍🍳 Meet {owner_name}</b>", self.styles['Normal']))
                story.append(Paragraph(f"<i>\"{owner_story}\"</i>", self.styles['StoryText']))
            
            story.append(Spacer(1, 12))
        
        # Driver story WITH PHOTO
        driver = order_data.get('driver', {})
        if driver:
            driver_image_path = driver.get('image', '')
            driver_name = driver.get('name', 'Driver')
            driver_story = driver.get('story', 'Thank you for the tip!')
            
            if driver_image_path and os.path.exists(driver_image_path):
                try:
                    driver_img = Image(driver_image_path, width=1.2*inch, height=1.2*inch)
                    driver_img.hAlign = 'LEFT'
                    
                    driver_text = f'''<b>🚗 Your Driver: {driver_name}</b><br/><br/>
                    <i>"{driver_story}"</i>'''
                    
                    driver_data = [[driver_img, Paragraph(driver_text, self.styles['StoryText'])]]
                    
                    driver_table = Table(driver_data, colWidths=[1.4*inch, 4.1*inch])
                    driver_table.setStyle(TableStyle([
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('LEFTPADDING', (1, 0), (1, 0), 12),
                        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f0fff4')),
                        ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#25D366')),
                        ('TOPPADDING', (0, 0), (-1, -1), 10),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                        ('LEFTPADDING', (0, 0), (0, 0), 10),
                        ('RIGHTPADDING', (-1, 0), (-1, 0), 10),
                    ]))
                    story.append(driver_table)
                except Exception as e:
                    print(f"Error loading driver image: {e}")
                    story.append(Paragraph(f"<b>🚗 Your Driver: {driver_name}</b>", self.styles['Normal']))
                    story.append(Paragraph(f"<i>\"{driver_story}\"</i>", self.styles['StoryText']))
            else:
                story.append(Paragraph(f"<b>🚗 Your Driver: {driver_name}</b>", self.styles['Normal']))
                story.append(Paragraph(f"<i>\"{driver_story}\"</i>", self.styles['StoryText']))
            
            story.append(Spacer(1, 12))
        
        # Community impact message
        story.append(Spacer(1, 8))
        story.append(Paragraph(
            "<b>By ordering through LocalFirst YYC, you've helped:</b>",
            self.styles['Normal']
        ))
        story.append(Paragraph(
            "• Keep 100% of your dollars in Calgary<br/>"
            "• Support a family-owned business<br/>"
            "• Help a local driver earn fair wages<br/>"
            "• Build a stronger community",
            self.styles['StoryText']
        ))
        
        story.append(Spacer(1, 20))
        
        # Footer
        story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
        story.append(Spacer(1, 8))
        story.append(Paragraph(
            "Questions? Contact us at (403) 826-5529<br/>"
            "or message us on WhatsApp",
            ParagraphStyle('Footer', parent=self.styles['Normal'], fontSize=9, alignment=TA_CENTER, textColor=colors.grey)
        ))
        story.append(Spacer(1, 8))
        story.append(Paragraph(
            "<b>Thank you for supporting local! 💚</b>",
            ParagraphStyle('ThankYou', parent=self.styles['Normal'], fontSize=12, alignment=TA_CENTER, textColor=colors.HexColor('#25D366'))
        ))
        
        # Build PDF
        doc.build(story)
        return output_path

    def generate_kitchen_receipt(self, order_data, output_path):
        """
        Generate kitchen/store receipt for printing
        Optimized for thermal printers (80mm width)
        Clear, large text for kitchen staff
        """
        doc = SimpleDocTemplate(
            output_path,
            pagesize=(THERMAL_WIDTH, 11*inch),  # Thermal width, long page
            rightMargin=5*mm,
            leftMargin=5*mm,
            topMargin=5*mm,
            bottomMargin=5*mm
        )
        
        story = []
        
        # Styles for kitchen receipt (larger, clearer)
        kitchen_title = ParagraphStyle(
            'KitchenTitle',
            fontSize=16,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
            spaceAfter=4
        )
        
        kitchen_order = ParagraphStyle(
            'KitchenOrder',
            fontSize=24,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
            spaceAfter=8,
            textColor=colors.black
        )
        
        kitchen_item = ParagraphStyle(
            'KitchenItem',
            fontSize=14,
            alignment=TA_LEFT,
            fontName='Helvetica-Bold',
            spaceAfter=4
        )
        
        kitchen_normal = ParagraphStyle(
            'KitchenNormal',
            fontSize=10,
            alignment=TA_LEFT,
            spaceAfter=2
        )
        
        # Header
        story.append(Paragraph("🍕 LOCALFIRST YYC", kitchen_title))
        story.append(Paragraph("*** KITCHEN ORDER ***", kitchen_title))
        story.append(Spacer(1, 8))
        
        # Order number - BIG
        story.append(Paragraph(f"#{order_data.get('order_number', 'N/A')}", kitchen_order))
        
        # Time
        created_at = order_data.get('created_at', datetime.now().isoformat())
        order_time = datetime.fromisoformat(created_at).strftime('%I:%M %p')
        story.append(Paragraph(f"Time: {order_time}", kitchen_normal))
        story.append(Spacer(1, 8))
        
        # Dashed line
        story.append(Paragraph("-" * 30, kitchen_normal))
        story.append(Spacer(1, 4))
        
        # Customer name - important for calling out
        story.append(Paragraph(f"CUSTOMER: {order_data.get('customer_name', 'Guest').upper()}", kitchen_item))
        story.append(Spacer(1, 8))
        
        # Dashed line
        story.append(Paragraph("-" * 30, kitchen_normal))
        story.append(Spacer(1, 4))
        
        # ORDER ITEMS - Large and clear
        story.append(Paragraph("ORDER ITEMS:", kitchen_item))
        story.append(Spacer(1, 4))
        
        for item in order_data.get('items', []):
            qty = item.get('quantity', 1)
            name = item.get('name', 'Item')
            
            # Item with quantity
            story.append(Paragraph(f"<b>{qty}x {name.upper()}</b>", kitchen_item))
            
            # Toppings/customizations if any
            toppings = item.get('toppings', [])
            if toppings:
                for topping in toppings:
                    story.append(Paragraph(f"   + {topping}", kitchen_normal))
            
            # Special instructions
            instructions = item.get('instructions', '')
            if instructions:
                story.append(Paragraph(f"   ⚠️ NOTE: {instructions}", kitchen_normal))
            
            story.append(Spacer(1, 6))
        
        # Dashed line
        story.append(Paragraph("-" * 30, kitchen_normal))
        story.append(Spacer(1, 4))
        
        # Delivery info
        story.append(Paragraph("DELIVERY TO:", kitchen_item))
        story.append(Paragraph(order_data.get('customer_address', 'N/A'), kitchen_normal))
        story.append(Paragraph(f"Phone: {self._format_phone(order_data.get('customer_phone', ''))}", kitchen_normal))
        story.append(Spacer(1, 8))
        
        # Payment info
        payment_method = order_data.get('payment_method', 'card')
        if payment_method == 'cash':
            story.append(Paragraph("⚠️ CASH ON DELIVERY ⚠️", kitchen_item))
            story.append(Paragraph(f"Amount due: ${order_data.get('total', 0):.2f}", kitchen_item))
        else:
            story.append(Paragraph("✓ PAID ONLINE", kitchen_item))
        
        story.append(Spacer(1, 8))
        
        # Dashed line
        story.append(Paragraph("-" * 30, kitchen_normal))
        
        # Driver assignment (if available)
        driver = order_data.get('driver', {})
        if driver:
            story.append(Spacer(1, 4))
            story.append(Paragraph(f"DRIVER: {driver.get('name', 'TBD')}", kitchen_normal))
        
        # Print time
        story.append(Spacer(1, 8))
        story.append(Paragraph(f"Printed: {datetime.now().strftime('%I:%M:%S %p')}", 
                              ParagraphStyle('PrintTime', fontSize=8, alignment=TA_CENTER, textColor=colors.grey)))
        
        # Build PDF
        doc.build(story)
        return output_path
    
    def _format_phone(self, phone):
        """Format phone number for display"""
        if not phone:
            return ''
        digits = ''.join(filter(str.isdigit, str(phone)))
        if len(digits) == 10:
            return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        elif len(digits) == 11 and digits[0] == '1':
            return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
        return phone


def generate_sample_receipts():
    """Generate sample receipts for demo"""
    
    # Sample order data with PHOTOS
    order_data = {
        'order_number': 'LF-4829',
        'customer_name': 'Sarah Johnson',
        'customer_phone': '14035551234',
        'customer_address': '123 Main St NW, Calgary, AB T2N 1A1',
        'restaurant_name': 'AB King Pizza',
        'restaurant_owner': {
            'name': 'Fatima Al-Hassan',
            'image': '/home/claude/fatima_profile.jpg',  # Local profile image
            'story': "I came to Calgary from Jordan 12 years ago with nothing but my grandmother's recipes and a dream. Every pizza we make carries four generations of love. Your order today helps me put my two daughters through university and keeps our family tradition alive. From our family to yours - thank you for believing in us! 🙏"
        },
        'driver': {
            'name': 'Ahmed Hassan',
            'image': '/home/claude/ahmed_profile.jpg',  # Local profile image
            'story': "I'm a Computer Science student at the University of Calgary, originally from Sudan. Delivering for LocalFirst lets me pay my tuition without taking loans. Every tip goes straight into my education fund - I'm saving up to start my own tech company one day! Thank you for helping me build my future. 💚"
        },
        'items': [
            {'name': 'Pepperoni Classic (Large)', 'quantity': 1, 'price': 20.99, 'toppings': ['Extra Cheese']},
            {'name': 'Garlic Bread', 'quantity': 1, 'price': 5.99},
            {'name': 'Coca-Cola (2L)', 'quantity': 1, 'price': 3.99}
        ],
        'subtotal': 30.97,
        'discount': 3.10,
        'discount_type': 'first_order',
        'delivery_fee': 0,
        'tip': 5.57,
        'total': 33.44,
        'payment_method': 'visa',
        'created_at': datetime.now().isoformat()
    }
    
    generator = ReceiptGenerator()
    
    # Generate customer receipt with photos
    customer_receipt_path = '/mnt/user-data/outputs/customer_receipt.pdf'
    generator.generate_customer_receipt(order_data, customer_receipt_path)
    print(f"✅ Customer receipt generated: {customer_receipt_path}")
    
    # Generate kitchen receipt
    kitchen_receipt_path = '/mnt/user-data/outputs/kitchen_receipt.pdf'
    generator.generate_kitchen_receipt(order_data, kitchen_receipt_path)
    print(f"✅ Kitchen receipt generated: {kitchen_receipt_path}")
    
    # Generate COD example
    order_data_cod = order_data.copy()
    order_data_cod['order_number'] = 'LF-4830'
    order_data_cod['payment_method'] = 'cash'
    order_data_cod['customer_name'] = 'Mike Chen'
    
    kitchen_cod_path = '/mnt/user-data/outputs/kitchen_receipt_cod.pdf'
    generator.generate_kitchen_receipt(order_data_cod, kitchen_cod_path)
    print(f"✅ Kitchen receipt (COD) generated: {kitchen_cod_path}")
    
    return customer_receipt_path, kitchen_receipt_path, kitchen_cod_path


if __name__ == '__main__':
    generate_sample_receipts()
