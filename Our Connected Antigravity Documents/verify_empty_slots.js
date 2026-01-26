import { booking } from './src/lib/booking.js';

async function testEmptySlots() {
    console.log('Testing getSlots with invalid provider ID...');
    const result = await booking.getSlots('00000000-0000-0000-0000-000000000000');

    console.log('Data:', result.data);
    console.log('Error:', result.error);

    if (result.data && result.data.length === 0) {
        console.log('PASS: Returned empty array for invalid provider.');
    } else {
        console.error('FAIL: Did not return empty array.');
    }
}

testEmptySlots();
