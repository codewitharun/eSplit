from fpdf import FPDF

# Create PDF instance
pdf = FPDF()

# Add a page
pdf.add_page()

# Title
pdf.set_font("Arial", 'B', 16)
pdf.cell(200, 10, "Weight Loss & Productivity Plan", ln=True, align='C')

# Add a line break
pdf.ln(10)

# Subtitle: Introduction
pdf.set_font("Arial", 'B', 12)
pdf.cell(200, 10, "Introduction", ln=True)
pdf.set_font("Arial", '', 12)
pdf.multi_cell(0, 10, """
This PDF contains a detailed plan for weight loss, improving sleep schedule, meal preparation, and general productivity
for someone with a 9:30 AM to 7:30 PM office job. The plan also includes tips for intermittent fasting, workouts, and 
meal planning that can help you reach your goals while also preparing for DSA (Data Structures and Algorithms) practice
for a job switch.
""")

# Add a line break
pdf.ln(10)

# Subtitle: Plan Overview
pdf.set_font("Arial", 'B', 12)
pdf.cell(200, 10, "Plan Overview", ln=True)
pdf.set_font("Arial", '', 12)
pdf.multi_cell(0, 10, """
1. **Weight Loss & Fitness**: Focus on home workouts and fixing your eating and sleeping schedule. 
2. **Intermittent Fasting (IF)**: Include IF into your daily routine to help with weight loss.
3. **DSA Preparation**: Start practicing DSA in parallel with fitness goals.
4. **Meal Plan**: Prepare easy-to-make meals that support weight loss and productivity.
5. **Sleep Schedule**: Fix your sleep schedule to optimize both health and focus.

The routine has been designed to fit your office schedule and home life.
""")

# Add a line break
pdf.ln(10)

# Subtitle: Weight Loss Plan
pdf.set_font("Arial", 'B', 12)
pdf.cell(200, 10, "Weight Loss Plan", ln=True)
pdf.set_font("Arial", '', 12)
pdf.multi_cell(0, 10, """
1. **Morning** (7:00 AM - 9:00 AM)
   - Drink lukewarm water with lemon.
   - Optionally, drink fennel seed water.
   - If fasting, drink water or herbal tea.

2. **Lunch** (12:00 PM - 1:00 PM) - **Meal 1**
   - Quinoa bowl with chickpeas, avocado, cucumbers, and olive oil dressing.
   - Veggie stir-fry with tofu or tempeh.
   - Mixed salad with roasted veggies and protein like lentils or beans.

3. **Snack** (3:30 PM) - **Meal 2**
   - A small handful of almonds, or Greek yogurt with berries.
   - Hummus with carrot or cucumber sticks.

4. **Dinner** (7:30 PM) - **Meal 3**
   - Lentil or chickpea curry with brown rice or quinoa.
   - Veggie wrap with hummus and roasted vegetables.
   - Vegetable stew or soup.
""")

# Add a line break
pdf.ln(10)

# Subtitle: Meal Prep Tips
pdf.set_font("Arial", 'B', 12)
pdf.cell(200, 10, "Meal Prep Tips", ln=True)
pdf.set_font("Arial", '', 12)
pdf.multi_cell(0, 10, """
- **Batch Cook Grains**: Cook quinoa, rice, or oats ahead of time for convenience.
- **Prep Veggies**: Chop and store veggies for easy stir-fries or salads.
- **Make Sauces/Dressings**: Prepare dressings in advance for salads or wraps.
- **Storage**: Use containers to store meals and keep them fresh for the week.
""")

# Add a line break
pdf.ln(10)

# Subtitle: DSA Preparation Plan
pdf.set_font("Arial", 'B', 12)
pdf.cell(200, 10, "DSA Preparation Plan", ln=True)
pdf.set_font("Arial", '', 12)
pdf.multi_cell(0, 10, """
1. **Daily Routine for DSA**: Set aside 1-2 hours per day to practice DSA and algorithms.
2. **Focus on Basics**: Learn and practice the fundamentals first (Arrays, Linked Lists, Trees, Graphs).
3. **Use Resources**: Websites like LeetCode, GeeksforGeeks, and HackerRank will help with structured practice.
4. **Track Progress**: Use your future mobile app to track your DSA learning milestones.
""")

# Add a line break
pdf.ln(10)

# Subtitle: Sleep Schedule
pdf.set_font("Arial", 'B', 12)
pdf.cell(200, 10, "Sleep Schedule", ln=True)
pdf.set_font("Arial", '', 12)
pdf.multi_cell(0, 10, """
1. **Aim for 7-8 hours of sleep**.
2. **Set a fixed bedtime**: Try to go to bed by **11:00 PM** at the latest.
3. **Avoid screen time 1 hour before bed** to improve sleep quality.
4. **Wake up at 7:00 AM** to allow time for a morning routine.

A proper sleep routine is essential for both mental and physical well-being.
""")

# Add a line break
pdf.ln(10)

# Subtitle: Intermittent Fasting Tips
pdf.set_font("Arial", 'B', 12)
pdf.cell(200, 10, "Intermittent Fasting Tips", ln=True)
pdf.set_font("Arial", '', 12)
pdf.multi_cell(0, 10, """
1. **Eating Window**: Your eating window can be from **12 PM to 8 PM** (16/8 method).
2. **Stay Hydrated**: Drink plenty of water during the fasting period to control hunger.
3. **Avoid High-Calorie Snacks**: Keep snacks healthy and light during your eating window.

Intermittent fasting can help with weight management and overall health.
""")

# Add a line break
pdf.ln(10)

# Footer
pdf.set_font("Arial", 'I', 8)
pdf.cell(200, 10, "Prepared for Arun. Good luck with your weight loss, DSA practice, and career goals!", 0, 1, 'C')

# Output the PDF
pdf_output_path = "/mnt/data/Weight_Loss_Productivity_Plan.pdf"
pdf.output(pdf_output_path)

pdf_output_path  # Return file path for download
