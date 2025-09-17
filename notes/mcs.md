# 
### Understanding Monte Carlo Simulation for Software Teams

Monte Carlo simulation is a **forecasting technique** that uses random sampling to model the probability of different outcomes. For a software team, it helps to answer questions like, "What's the probability we'll finish 10 user stories in the next 3 weeks?" or "How many stories are we likely to complete by the end of the sprint?" The simulation uses **historical throughput data** (the number of items a team completes in a given period) to create a probabilistic forecast. Daniel Vacanti, in his work on **Actionable Agile Metrics**, highlights the importance of using historical data to predict future performance without relying on subjective estimates.
The key idea is that the future performance of a team is likely to be similar to its past performance, with some degree of random variation. Instead of a single-point estimate (e.g., "We'll finish 10 stories"), the Monte Carlo simulation provides a range of possible outcomes and the probability of each.


### Step-by-Step Instructions

Here are the step-by-step instructions for creating a Monte Carlo simulation for a software team based on throughput data. You can provide these instructions to an LLM to build a simple application.

**Step 1: Collect Historical Throughput Data**

First, you need to collect a sufficient amount of historical data. The more data points you have, the more accurate the simulation will be.
**1** **Define a Time Period:** Choose a consistent time period for measuring throughput. A common choice is **weekly throughput** (how many items were completed each week).
**2** **Gather the Data:** Collect the number of items (e.g., user stories, bugs) completed in each of those periods. For example, your data might look like this: [3, 5, 4, 6, 5, 3, 7, 4, 5, 6]. This is your **sample space** of possible throughput values.

⠀
**Step 2: Define Simulation Parameters**

Next, specify the parameters for the Monte Carlo simulation.
**1** **Number of Simulations:** Determine how many times you want to run the simulation. A larger number of simulations will increase the accuracy of the result. A good starting point is **10,000 simulations** or more.
**2** **Forecast Horizon:** Define the number of future periods you want to forecast. For a sprint, this might be 1, 2, or 3 weeks. For a larger project, it could be 10 or 20 weeks.

⠀
**Step 3: Run the Simulation**

This is the core of the Monte Carlo process. The simulation will randomly "roll the dice" based on your historical data.
**1** **Iterate:** For each of the N simulations (e.g., 10,000), you will run a loop that simulates the future.
**2** **Random Sampling:** In each simulation, and for each period in the forecast horizon, randomly select a throughput value from your historical data set. You can use a function that picks a random element from the throughput_data array.
**3** **Sum the Results:** After randomly selecting a throughput for each period in the forecast horizon, sum up the total items for that entire simulated run. This gives you one possible outcome.
**4** **Store the Result:** Store this total in a list of results. You'll end up with a list of N numbers, each representing a possible total number of completed items for the forecast period. For example, after 10,000 simulations, you'll have a list of 10,000 possible outcomes.

⠀
**Step 4: Analyze the Results**

Now, analyze the distribution of your simulation results to create a probabilistic forecast.
**1** **Sort the Outcomes:** Sort the list of simulated outcomes in ascending order.
**2** **Calculate Probabilities:** To find the probability of a certain outcome, look at where it falls in the sorted list.
	* **50th Percentile:** The value at the halfway point (50th percentile) is the number of items you have a **50% probability** of completing.
	* **85th Percentile:** The value at the 85th percentile is the number of items you have an **85% probability** of completing. This is often a good confidence level for forecasting.
	* **95th Percentile:** The value at the 95th percentile is the number of items you have a **95% probability** of completing.
**3** **Visualize:** Create a histogram or a cumulative flow diagram to visualize the results. A histogram shows the frequency of each outcome, and the cumulative flow diagram shows the probability of completing at least a certain number of items. This makes the data much easier to interpret.

⠀

### Example Walkthrough

Let's use a simple example to illustrate the process.
**Scenario:** We want to forecast how many stories we'll complete in the next **14 days**
**1** **Data:** Our daily throughput data is [3, 5, 4, 6, 5, 7, 1, 0, 4, 9, 12, 2, 0].
**2** **Parameters:** We'll run **100 simulations** and our forecast horizon is **14 days**.
**3** **Simulation:**
	* **Simulation 1:** Randomly pick a value for Day 1 (e.g., 5) and for Day 2 (e.g., 3), through to day 14. Store the total.
	* **Simulation 2:** Randomly pick a value for Day 1 (e.g., 6) through to day 14. Store the total.
	* ... Repeat 98 more times.
**4** **Analysis:** After 100 simulations, you'll have a list of 100 possible outcomes. Sort the list.
	* If the 50th item in the sorted list is 9, you can say, "There is a **50% chance** we will complete at least 9 stories in the next 2 weeks."
	* If the 85th item is 12, you can say, "There is an **85% chance** we will complete at least 12 stories in the next 2 weeks."
