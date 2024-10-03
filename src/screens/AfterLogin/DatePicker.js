import React, { useState } from 'react';
import { View, Button, Modal, TouchableOpacity, Text } from 'react-native';
import { Calendar } from 'react-native-calendars';

const DatePicker = ({ selectedDate, setSelectedDate }) => {
    const [calendarVisible, setCalendarVisible] = useState(false);

    // Toggle Calendar visibility
    const toggleCalendar = () => {
        setCalendarVisible(!calendarVisible);
    };

    // Handle date selection from the calendar
    const onDayPress = (day) => {
        setSelectedDate(day.dateString); // set the selected date (ISO format YYYY-MM-DD)
        toggleCalendar(); // Close the calendar after selecting the date
    };

    return (
        <View style={{ padding: 20 }}>
            {/* Button to open Calendar */}
            <TouchableOpacity onPress={toggleCalendar} style={{ backgroundColor: 'blue', padding: 10, borderRadius: 5 }}>
                <Text style={{ color: 'white', textAlign: 'center' }}>Select Date</Text>
            </TouchableOpacity>

            {/* Display selected date */}
            {selectedDate ? <Text style={{ marginTop: 20 }}>Selected Date: {selectedDate}</Text> : null}

            {/* Modal for the calendar */}
            <Modal visible={calendarVisible} animationType="slide" transparent={true}>
                <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                    <View style={{ backgroundColor: 'white', padding: 20, borderRadius: 10, marginHorizontal: 30 }}>
                        <Calendar
                            // Initially visible month. Default = Date()
                            current={selectedDate || new Date().toISOString().split('T')[0]} // If no date is selected, show the current month
                            onDayPress={onDayPress} // Handler for when a day is pressed
                            markedDates={{
                                [selectedDate]: { selected: true, selectedColor: 'blue' }, // Highlight the selected date
                            }}
                        />

                        {/* Close button */}
                        <TouchableOpacity onPress={toggleCalendar} style={{ marginTop: 10, backgroundColor: 'blue', padding: 10, borderRadius: 5 }}>
                            <Text style={{ color: 'white', textAlign: 'center' }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default DatePicker;
